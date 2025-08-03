/**
 * Orchestrator Service - Coordinates Evaluation Process
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { QueueManager } from '../queue/index.js';
import { evaluationRepository, agentResultRepository } from '../database/index.js';
import { 
  EvaluationRequest, 
  EvaluationProgress, 
  EvaluationResult, 
  OrchestratorConfig,
  EvaluationMetrics,
  AgentProgress,
  AgentExecutionResult
} from './types.js';
import { 
  JobPriority, 
  EvaluationRequestJobData, 
  AgentTaskJobData, 
  ResultProcessingJobData 
} from '../queue/types.js';
import { 
  AgentType, 
  EvaluationStatus, 
  EvaluationPriority,
  getEnvironmentConfig
} from '@ai-validation/shared';
import { AgentService, AgentRequest, AgentExecutionContext } from '../agents/index.js';
import { MessageBus } from '../communication/message-bus.js';
import { AgentCoordinator } from '../communication/agent-coordinator.js';
import { 
  MessageType, 
  MessageHandler, 
  Message,
  EvaluationStartMessage,
  EvaluationCompleteMessage,
  EvaluationErrorMessage,
  EvaluationProgressMessage
} from '../communication/message-types.js';

export class OrchestratorService extends EventEmitter implements MessageHandler {
  private static instance: OrchestratorService;
  private queueManager: QueueManager;
  private messageBus: MessageBus;
  private agentCoordinator: AgentCoordinator;
  private config: OrchestratorConfig;
  private activeEvaluations: Map<string, EvaluationProgress> = new Map();
  private evaluationResults: Map<string, EvaluationResult> = new Map();
  private metrics: EvaluationMetrics;

  private constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    const envConfig = getEnvironmentConfig();
    
    this.queueManager = QueueManager.getInstance();
    this.messageBus = MessageBus.getInstance();
    this.agentCoordinator = new AgentCoordinator();
    this.config = {
      maxConcurrentEvaluations: envConfig.orchestrator?.maxConcurrentEvaluations || 10,
      defaultTimeout: envConfig.orchestrator?.defaultTimeout || 300000, // 5 minutes
      defaultAgentTypes: ['market-research'],
      enableProgressTracking: true,
      autoRetryFailedAgents: true,
      scoringWeights: {
        'market-research': 1.0,
        'competitive-analysis': 0.8,
        'customer-research': 0.9,
        'technical-feasibility': 0.7,
        'financial-analysis': 0.8
      },
      ...config
    };

    this.metrics = {
      totalEvaluations: 0,
      activeEvaluations: 0,
      completedEvaluations: 0,
      failedEvaluations: 0,
      averageProcessingTime: 0,
      averageScore: 0,
      agentSuccessRates: {},
      throughput: 0
    };
  }

  static getInstance(config?: Partial<OrchestratorConfig>): OrchestratorService {
    if (!OrchestratorService.instance) {
      OrchestratorService.instance = new OrchestratorService(config);
    }
    return OrchestratorService.instance;
  }

  async initialize(): Promise<void> {
    await this.queueManager.initialize();
    this.initializeProcessors();
    await this.initializeMessageHandlers();
    console.log('Orchestrator Service initialized');
  }

  private async initializeMessageHandlers(): Promise<void> {
    await this.messageBus.subscribe(MessageType.EVALUATION_COMPLETE, this);
    await this.messageBus.subscribe(MessageType.EVALUATION_ERROR, this);
    await this.messageBus.subscribe(MessageType.EVALUATION_PROGRESS, this);
  }

  canHandle(message: Message): message is EvaluationCompleteMessage | EvaluationErrorMessage | EvaluationProgressMessage {
    return [
      MessageType.EVALUATION_COMPLETE,
      MessageType.EVALUATION_ERROR,
      MessageType.EVALUATION_PROGRESS
    ].includes(message.type);
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case MessageType.EVALUATION_COMPLETE:
        await this.handleEvaluationComplete(message as EvaluationCompleteMessage);
        break;
      case MessageType.EVALUATION_ERROR:
        await this.handleEvaluationError(message as EvaluationErrorMessage);
        break;
      case MessageType.EVALUATION_PROGRESS:
        await this.handleEvaluationProgress(message as EvaluationProgressMessage);
        break;
    }
  }

  private initializeProcessors(): void {
    // Setup evaluation request processor
    this.queueManager.setupEvaluationProcessor(async (data: EvaluationRequestJobData) => {
      await this.processEvaluationRequest(data);
    });

    // Setup agent task processor
    this.queueManager.setupAgentProcessor(async (data: AgentTaskJobData) => {
      await this.processAgentTask(data);
    });

    // Setup result processing processor
    this.queueManager.setupResultProcessor(async (data: ResultProcessingJobData) => {
      await this.processEvaluationResults(data);
    });
  }

  async requestEvaluation(request: EvaluationRequest): Promise<string> {
    // Check concurrent evaluation limit
    if (this.activeEvaluations.size >= this.config.maxConcurrentEvaluations) {
      throw new Error('Maximum concurrent evaluations reached. Please try again later.');
    }

    const evaluationId = uuidv4();
    const correlationId = request.correlationId || uuidv4();

    // Create evaluation progress tracking
    const progress: EvaluationProgress = {
      evaluationId,
      status: 'pending',
      progress: 0,
      agentProgress: {},
      errors: []
    };

    this.activeEvaluations.set(evaluationId, progress);

    // Create job data
    const jobData: EvaluationRequestJobData = {
      correlationId,
      timestamp: new Date(),
      businessIdeaId: request.businessIdeaId,
      userId: request.userId,
      priority: this.mapPriorityToJobPriority(request.priority || 'normal'),
      metadata: {
        evaluationId,
        agentTypes: request.agentTypes || this.config.defaultAgentTypes,
        config: request.config
      }
    };

    // Add to queue
    await this.queueManager.addEvaluationRequest(jobData, {
      priority: this.mapPriorityToJobPriority(request.priority || 'normal')
    });

    // Update metrics
    this.metrics.totalEvaluations++;
    this.metrics.activeEvaluations++;

    this.emit('evaluation-requested', evaluationId, request);
    console.log(`Evaluation requested: ${evaluationId} for business idea: ${request.businessIdeaId}`);

    return evaluationId;
  }

  async submitEvaluationRequest(request: {
    businessIdeaId: string;
    businessIdeaTitle: string;
    businessIdeaDescription: string;
    agentTypes: AgentType[];
    priority?: EvaluationPriority;
  }): Promise<string> {
    const evaluationRequest: EvaluationRequest = {
      businessIdeaId: request.businessIdeaId,
      businessIdea: {
        id: request.businessIdeaId,
        title: request.businessIdeaTitle,
        description: request.businessIdeaDescription
      },
      agentTypes: request.agentTypes,
      priority: request.priority || 'normal'
    };

    return this.requestEvaluation(evaluationRequest);
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    const queueHealth = await this.queueManager.getHealthStatus();
    const activeEvaluationsCount = this.activeEvaluations.size;
    
    return {
      status: queueHealth.healthy ? 'healthy' : 'unhealthy',
      details: {
        queue: queueHealth,
        activeEvaluations: activeEvaluationsCount,
        maxConcurrentEvaluations: this.config.maxConcurrentEvaluations,
        metrics: this.metrics
      }
    };
  }

  private async processEvaluationRequest(data: EvaluationRequestJobData): Promise<void> {
    const evaluationId = data.metadata?.evaluationId;
    if (!evaluationId) {
      throw new Error('Evaluation ID not found in job data');
    }

    const progress = this.activeEvaluations.get(evaluationId);
    if (!progress) {
      throw new Error(`Evaluation progress not found: ${evaluationId}`);
    }

    try {
      // Create evaluation record in database
      const evaluation = await evaluationRepository.create({
        business_idea_id: data.businessIdeaId,
        priority: data.priority === JobPriority.HIGH ? 'high' : 
                 data.priority === JobPriority.LOW ? 'low' : 'normal'
      });

      // Keep the original evaluationId for tracking, but store database ID separately
      progress.dbEvaluationId = evaluation.id;

      // Update evaluation status to analyzing
      await evaluationRepository.update(evaluation.id, {
        status: 'analyzing',
        started_at: new Date()
      });

      // Update progress
      progress.status = 'analyzing';
      progress.startedAt = new Date();
      progress.progress = 10;

      this.emit('evaluation-started', evaluation.id);

      // Get business idea data (would normally fetch from database)
      const businessIdea = {
        id: data.businessIdeaId,
        title: 'Sample Business Idea', // TODO: Fetch from database
        description: 'Sample description' // TODO: Fetch from database
      };

      // Get agent types to execute
      const agentTypes = data.metadata?.agentTypes || this.config.defaultAgentTypes;

      // Initialize agent progress tracking and create agent result records
      for (const agentType of agentTypes) {
        progress.agentProgress[agentType] = {
          agentType,
          status: 'pending',
          progress: 0
        };

        // Create agent result record
        await agentResultRepository.create({
          evaluation_id: evaluation.id,
          agent_type: agentType,
          input_data: {
            businessIdea,
            analysisType: this.getAnalysisTypeForAgent(agentType)
          }
        });
      }

      // Publish evaluation start message
      const evaluationStartMessage = this.messageBus.createMessage<EvaluationStartMessage>(
        MessageType.EVALUATION_START,
        {
          evaluationId,
          businessIdea,
          priority: data.priority === JobPriority.HIGH ? 'high' : 
                   data.priority === JobPriority.LOW ? 'low' : 'normal',
          requestedAgents: agentTypes
        }
      );

      await this.messageBus.publish(evaluationStartMessage);

      // Start agent workflow through coordinator
      await this.agentCoordinator.startWorkflow(evaluationId, businessIdea, agentTypes);

      progress.progress = 30;
      this.emit('evaluation-progress', evaluation.id, progress);

    } catch (error: any) {
      progress.status = 'failed';
      progress.errors?.push(error.message);
      
      // Update database record if evaluation was created
      if (progress.dbEvaluationId) {
        await evaluationRepository.update(progress.dbEvaluationId, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date()
        });
      }
      
      this.metrics.failedEvaluations++;
      this.metrics.activeEvaluations--;
      
      this.emit('evaluation-failed', evaluationId, error);
      throw error;
    }
  }

  private async scheduleAgentTask(data: {
    correlationId: string;
    evaluationId: string;
    agentType: AgentType;
    businessIdea: { id: string; title: string; description: string };
    analysisType: string;
  }): Promise<void> {
    const agentJobData: AgentTaskJobData = {
      correlationId: data.correlationId,
      timestamp: new Date(),
      evaluationId: data.evaluationId,
      agentType: data.agentType,
      businessIdea: data.businessIdea,
      analysisType: data.analysisType,
      timeout: this.config.defaultTimeout
    };

    await this.queueManager.addAgentTask(agentJobData);
    
    // Update agent progress
    const progress = this.activeEvaluations.get(data.evaluationId);
    if (progress?.agentProgress[data.agentType]) {
      progress.agentProgress[data.agentType].status = 'pending';
    }
  }

  private getAnalysisTypeForAgent(agentType: AgentType): string {
    switch (agentType) {
      case 'market-research':
        return 'market_size';
      case 'competitive-analysis':
        return 'competitors';
      case 'customer-research':
        return 'customer_segments';
      case 'technical-feasibility':
        return 'technical_requirements';
      case 'financial-analysis':
        return 'financial_projections';
      default:
        return 'general_analysis';
    }
  }

  private async processAgentTask(data: AgentTaskJobData): Promise<void> {
    const evaluationId = data.evaluationId;
    const progress = this.activeEvaluations.get(evaluationId);
    
    if (!progress) {
      console.warn(`No active evaluation found for agent task: ${evaluationId}`);
      return;
    }

    try {
      // Update agent progress to running
      if (progress.agentProgress[data.agentType]) {
        progress.agentProgress[data.agentType].status = 'running';
        progress.agentProgress[data.agentType].progress = 25;
        progress.agentProgress[data.agentType].startedAt = new Date();
      }

      // Prepare agent request
      const agentRequest: AgentRequest = {
        businessIdea: data.businessIdea,
        analysisType: data.analysisType,
        options: {
          timeout: data.timeout || this.config.defaultTimeout,
          maxRetries: this.config.autoRetryFailedAgents ? 2 : 0
        }
      };

      const agentContext: AgentExecutionContext = {
        evaluationId,
        correlationId: data.correlationId,
        timestamp: new Date()
      };

      // Execute agent using Agent Service
      const agentService = AgentService.getInstance();
      const executionResult = await agentService.executeAgent(
        data.agentType,
        agentRequest,
        agentContext,
        {
          maxRetries: agentRequest.options?.maxRetries || 2,
          timeout: agentRequest.options?.timeout || this.config.defaultTimeout
        }
      );

      if (executionResult.success && executionResult.response) {
        const response = executionResult.response;

        // Update agent progress to completed
        if (progress.agentProgress[data.agentType]) {
          progress.agentProgress[data.agentType].status = 'completed';
          progress.agentProgress[data.agentType].progress = 100;
          progress.agentProgress[data.agentType].completedAt = new Date();
          progress.agentProgress[data.agentType].score = response.score;
          progress.agentProgress[data.agentType].insights = response.insights;
        }

        // Update agent result in database (use database ID)
        const dbEvaluationId = progress.dbEvaluationId || evaluationId;
        const dbAgentResult = await agentResultRepository.findByEvaluationAndAgent(
          dbEvaluationId, 
          data.agentType
        );
        
        if (dbAgentResult) {
          await agentResultRepository.update(dbAgentResult.id, {
            status: 'completed',
            output_data: response.rawData,
            score: response.score,
            insights: { insights: response.insights },
            completed_at: new Date()
          });
        }

        this.emit('agent-task-completed', evaluationId, data.agentType, response);
      } else {
        // Agent execution failed
        const error = executionResult.error || 'Unknown error';
        
        if (progress.agentProgress[data.agentType]) {
          progress.agentProgress[data.agentType].status = 'failed';
          progress.agentProgress[data.agentType].error = error;
        }

        // Update agent result in database to failed
        const dbEvaluationId = progress.dbEvaluationId || evaluationId;
        const dbAgentResult = await agentResultRepository.findByEvaluationAndAgent(
          dbEvaluationId, 
          data.agentType
        );
        
        if (dbAgentResult) {
          await agentResultRepository.update(dbAgentResult.id, {
            status: 'failed',
            error_message: error,
            completed_at: new Date()
          });
        }

        this.emit('agent-task-failed', evaluationId, data.agentType, new Error(error));
        return; // Don't proceed to result processing if agent failed
      }

      // Check if all agents are completed
      const allAgentsCompleted = Object.values(progress.agentProgress).every(
        agentProgress => agentProgress.status === 'completed'
      );

      if (allAgentsCompleted) {
        // Get all agent results for this evaluation (use database ID)
        const dbEvaluationId = progress.dbEvaluationId || evaluationId;
        const agentResults = await agentResultRepository.findByEvaluationId(dbEvaluationId);
        
        // Create result processing job (use original evaluationId for tracking)
        const resultData: ResultProcessingJobData = {
          correlationId: data.correlationId,
          timestamp: new Date(),
          evaluationId, // Use original UUID that matches activeEvaluations key
          agentResults: agentResults.map(ar => ({
            agentType: ar.agent_type,
            score: ar.score || 0,
            insights: ar.insights?.insights || [],
            rawData: ar.output_data
          }))
        };

        await this.queueManager.addResultProcessing(resultData);
      }

    } catch (error: any) {
      // Update agent progress to failed
      if (progress.agentProgress[data.agentType]) {
        progress.agentProgress[data.agentType].status = 'failed';
        progress.agentProgress[data.agentType].error = error.message;
      }

      console.error(`Agent task failed for ${data.agentType}:`, error);
      this.emit('agent-task-failed', evaluationId, data.agentType, error);
    }
  }

  private async processEvaluationResults(data: ResultProcessingJobData): Promise<void> {
    const evaluationId = data.evaluationId;
    const progress = this.activeEvaluations.get(evaluationId);
    
    if (!progress) {
      console.warn(`No active evaluation found for ID: ${evaluationId}`);
      return;
    }

    try {
      // Get evaluation from database (use database ID if available)
      const dbEvaluationId = progress?.dbEvaluationId || evaluationId;
      const evaluation = await evaluationRepository.findById(dbEvaluationId);
      if (!evaluation) {
        throw new Error(`Evaluation not found in database: ${dbEvaluationId}`);
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(data.agentResults);
      
      // Update agent results in database
      for (const agentResult of data.agentResults) {
        const dbAgentResult = await agentResultRepository.findByEvaluationAndAgent(
          dbEvaluationId, 
          agentResult.agentType as AgentType
        );
        
        if (dbAgentResult) {
          await agentResultRepository.update(dbAgentResult.id, {
            status: 'completed',
            output_data: agentResult.rawData,
            score: agentResult.score,
            insights: { insights: agentResult.insights },
            completed_at: new Date()
          });
        }
      }

      // Create final evaluation result
      const result: EvaluationResult = {
        evaluationId,
        businessIdeaId: evaluation.business_idea_id,
        status: 'completed',
        overallScore,
        confidence: this.calculateConfidence(data.agentResults),
        summary: this.generateSummary(data.agentResults),
        agentResults: data.agentResults.map(ar => ({
          agentType: ar.agentType as AgentType,
          status: 'completed',
          score: ar.score,
          insights: ar.insights,
          details: ar.rawData,
          processingTime: 0 // TODO: Calculate actual processing time
        })),
        metadata: {
          startedAt: progress.startedAt || new Date(),
          completedAt: new Date(),
          processingTime: progress.startedAt ? Date.now() - progress.startedAt.getTime() : 0,
          agentsExecuted: data.agentResults.length,
          agentsFailed: 0,
          correlationId: data.correlationId
        }
      };

      // Update evaluation in database
      await evaluationRepository.update(dbEvaluationId, {
        status: 'completed',
        completed_at: new Date(),
        results: {
          overallScore,
          confidence: result.confidence,
          summary: result.summary,
          agentCount: data.agentResults.length
        }
      });

      // Update progress
      progress.status = 'completed';
      progress.progress = 100;

      // Store result
      this.evaluationResults.set(evaluationId, result);

      // Update metrics
      this.metrics.completedEvaluations++;
      this.metrics.activeEvaluations--;
      this.updateAverageScore(overallScore);
      this.updateProcessingTime(result.metadata.processingTime);

      // Clean up active evaluation
      this.activeEvaluations.delete(evaluationId);

      this.emit('evaluation-completed', evaluationId, result);
      console.log(`Evaluation completed: ${evaluationId} with score: ${overallScore}`);

    } catch (error: any) {
      progress.status = 'failed';
      progress.errors?.push(error.message);
      
      // Update database record
      await evaluationRepository.update(dbEvaluationId, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date()
      });
      
      this.metrics.failedEvaluations++;
      this.metrics.activeEvaluations--;
      
      this.emit('evaluation-failed', evaluationId, error);
    }
  }

  private calculateOverallScore(agentResults: Array<{ agentType: string; score: number; }>): number {
    if (agentResults.length === 0) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    for (const result of agentResults) {
      const weight = this.config.scoringWeights[result.agentType as AgentType] || 1.0;
      totalScore += result.score * weight;
      totalWeight += weight;
    }

    return Math.round(totalScore / totalWeight);
  }

  private calculateConfidence(agentResults: Array<{ agentType: string; score: number; }>): 'high' | 'medium' | 'low' {
    const scores = agentResults.map(r => r.score);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 10 && avgScore > 70) return 'high';
    if (stdDev < 20 && avgScore > 50) return 'medium';
    return 'low';
  }

  private generateSummary(agentResults: Array<{ agentType: string; insights: string[]; score: number; }>): {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    recommendations: string[];
  } {
    const allInsights = agentResults.flatMap(r => r.insights);
    
    // Simple categorization (in real implementation, would use NLP)
    return {
      strengths: allInsights.filter(insight => 
        insight.toLowerCase().includes('strong') || 
        insight.toLowerCase().includes('good') ||
        insight.toLowerCase().includes('advantage')
      ),
      weaknesses: allInsights.filter(insight => 
        insight.toLowerCase().includes('weak') || 
        insight.toLowerCase().includes('challenge') ||
        insight.toLowerCase().includes('difficult')
      ),
      opportunities: allInsights.filter(insight => 
        insight.toLowerCase().includes('opportunity') || 
        insight.toLowerCase().includes('potential') ||
        insight.toLowerCase().includes('growth')
      ),
      threats: allInsights.filter(insight => 
        insight.toLowerCase().includes('threat') || 
        insight.toLowerCase().includes('risk') ||
        insight.toLowerCase().includes('competition')
      ),
      recommendations: allInsights.filter(insight => 
        insight.toLowerCase().includes('recommend') || 
        insight.toLowerCase().includes('should') ||
        insight.toLowerCase().includes('consider')
      )
    };
  }

  private mapPriorityToJobPriority(priority: EvaluationPriority): JobPriority {
    switch (priority) {
      case 'high': return JobPriority.HIGH;
      case 'normal': return JobPriority.NORMAL;
      case 'low': return JobPriority.LOW;
      default: return JobPriority.NORMAL;
    }
  }

  private updateAverageScore(newScore: number): void {
    const totalCompleted = this.metrics.completedEvaluations;
    if (totalCompleted === 1) {
      this.metrics.averageScore = newScore;
    } else {
      this.metrics.averageScore = 
        (this.metrics.averageScore * (totalCompleted - 1) + newScore) / totalCompleted;
    }
  }

  private updateProcessingTime(processingTime: number): void {
    const totalCompleted = this.metrics.completedEvaluations;
    if (totalCompleted === 1) {
      this.metrics.averageProcessingTime = processingTime;
    } else {
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (totalCompleted - 1) + processingTime) / totalCompleted;
    }
  }

  // Public API methods
  getEvaluationProgress(evaluationId: string): EvaluationProgress | undefined {
    return this.activeEvaluations.get(evaluationId);
  }

  getEvaluationResult(evaluationId: string): EvaluationResult | undefined {
    return this.evaluationResults.get(evaluationId);
  }

  getMetrics(): EvaluationMetrics {
    return { ...this.metrics };
  }

  getActiveEvaluations(): EvaluationProgress[] {
    return Array.from(this.activeEvaluations.values());
  }

  async pauseEvaluation(evaluationId: string): Promise<void> {
    const progress = this.activeEvaluations.get(evaluationId);
    if (progress) {
      // TODO: Implement pause logic
      this.emit('evaluation-paused', evaluationId);
    }
  }

  async cancelEvaluation(evaluationId: string): Promise<void> {
    const progress = this.activeEvaluations.get(evaluationId);
    if (progress) {
      progress.status = 'failed';
      progress.errors?.push('Evaluation cancelled by user');
      
      this.activeEvaluations.delete(evaluationId);
      this.metrics.failedEvaluations++;
      this.metrics.activeEvaluations--;
      
      this.emit('evaluation-cancelled', evaluationId);
    }
  }

  // Message Handlers

  private async handleEvaluationComplete(message: EvaluationCompleteMessage): Promise<void> {
    const { evaluationId, results, overallScore, completionTime, summary } = message.payload;
    
    console.log(`[Orchestrator] Evaluation completed: ${evaluationId}`);

    const progress = this.activeEvaluations.get(evaluationId);
    if (!progress) {
      console.warn(`[Orchestrator] No progress found for completed evaluation: ${evaluationId}`);
      return;
    }

    // Update progress
    progress.status = 'completed';
    progress.progress = 100;
    progress.completedAt = new Date();
    progress.results = results;

    // Update database
    if (progress.dbEvaluationId) {
      await evaluationRepository.update(progress.dbEvaluationId, {
        status: 'completed',
        completed_at: new Date(),
        results: {
          overallScore,
          summary,
          agentResults: results.map(r => ({
            agentType: r.agent_type,
            score: r.score,
            insights: r.insights
          }))
        }
      });

      // Update agent results in database
      for (const result of results) {
        const agentResult = await agentResultRepository.findByEvaluationAndAgent(
          progress.dbEvaluationId,
          result.agent_type
        );
        
        if (agentResult) {
          await agentResultRepository.update(agentResult.id, {
            status: 'completed',
            output_data: result.output_data,
            score: result.score,
            insights: result.insights,
            completed_at: new Date()
          });
        }
      }
    }

    // Store final result
    const evaluationResult: EvaluationResult = {
      evaluationId,
      businessIdeaId: progress.businessIdeaId,
      status: 'completed',
      overallScore: overallScore || 0,
      agentResults: results.map(r => ({
        agentType: r.agent_type,
        success: true,
        score: r.score || 0,
        confidence: r.confidence || 'medium',
        insights: r.insights || {},
        executionTime: completionTime / results.length, // Approximate
        metadata: r.metadata || {}
      })),
      completedAt: new Date(),
      totalTime: completionTime
    };

    this.evaluationResults.set(evaluationId, evaluationResult);
    this.activeEvaluations.delete(evaluationId);

    // Update metrics
    this.metrics.completedEvaluations++;
    this.metrics.activeEvaluations--;
    this.updateAverageMetrics(evaluationResult);

    this.emit('evaluation-completed', evaluationId, evaluationResult);
  }

  private async handleEvaluationError(message: EvaluationErrorMessage): Promise<void> {
    const { evaluationId, error, partialResults } = message.payload;
    
    console.error(`[Orchestrator] Evaluation failed: ${evaluationId}`, error);

    const progress = this.activeEvaluations.get(evaluationId);
    if (!progress) {
      console.warn(`[Orchestrator] No progress found for failed evaluation: ${evaluationId}`);
      return;
    }

    // Update progress
    progress.status = 'failed';
    progress.completedAt = new Date();
    progress.errors = progress.errors || [];
    progress.errors.push(error.message);

    // Update database
    if (progress.dbEvaluationId) {
      await evaluationRepository.update(progress.dbEvaluationId, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date()
      });
    }

    // Store partial result if available
    if (partialResults && partialResults.length > 0) {
      const evaluationResult: EvaluationResult = {
        evaluationId,
        businessIdeaId: progress.businessIdeaId,
        status: 'failed',
        overallScore: 0,
        agentResults: partialResults.map(r => ({
          agentType: r.agent_type,
          success: r.status === 'completed',
          score: r.score || 0,
          confidence: r.confidence || 'low',
          insights: r.insights || {},
          executionTime: 0,
          metadata: r.metadata || {}
        })),
        completedAt: new Date(),
        totalTime: Date.now() - (progress.startedAt?.getTime() || Date.now()),
        error: error.message
      };

      this.evaluationResults.set(evaluationId, evaluationResult);
    }

    this.activeEvaluations.delete(evaluationId);

    // Update metrics
    this.metrics.failedEvaluations++;
    this.metrics.activeEvaluations--;

    this.emit('evaluation-failed', evaluationId, error);
  }

  private async handleEvaluationProgress(message: EvaluationProgressMessage): Promise<void> {
    const { evaluationId, overallProgress, completedAgents, runningAgents, pendingAgents, failedAgents } = message.payload;
    
    const progress = this.activeEvaluations.get(evaluationId);
    if (!progress) {
      return;
    }

    // Update overall progress
    progress.progress = overallProgress;

    // Update agent progress
    for (const agentType of completedAgents) {
      if (progress.agentProgress[agentType]) {
        progress.agentProgress[agentType].status = 'completed';
        progress.agentProgress[agentType].progress = 100;
      }
    }

    for (const agentType of runningAgents) {
      if (progress.agentProgress[agentType]) {
        progress.agentProgress[agentType].status = 'running';
        // Progress will be updated by individual agent progress messages
      }
    }

    for (const agentType of pendingAgents) {
      if (progress.agentProgress[agentType]) {
        progress.agentProgress[agentType].status = 'pending';
      }
    }

    for (const failedAgent of failedAgents) {
      if (progress.agentProgress[failedAgent.agentType]) {
        progress.agentProgress[failedAgent.agentType].status = 'failed';
        progress.agentProgress[failedAgent.agentType].error = failedAgent.error;
      }
    }

    this.emit('evaluation-progress', evaluationId, progress);
  }

  private updateAverageMetrics(result: EvaluationResult): void {
    // Update average score
    const totalCompleted = this.metrics.completedEvaluations;
    this.metrics.averageScore = (
      (this.metrics.averageScore * (totalCompleted - 1)) + result.overallScore
    ) / totalCompleted;

    // Update average processing time
    this.metrics.averageProcessingTime = (
      (this.metrics.averageProcessingTime * (totalCompleted - 1)) + result.totalTime
    ) / totalCompleted;

    // Update agent success rates
    for (const agentResult of result.agentResults) {
      if (!this.metrics.agentSuccessRates[agentResult.agentType]) {
        this.metrics.agentSuccessRates[agentResult.agentType] = { total: 0, successful: 0 };
      }
      
      const rates = this.metrics.agentSuccessRates[agentResult.agentType];
      rates.total++;
      if (agentResult.success) {
        rates.successful++;
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Orchestrator Service...');
    
    // Cancel all active workflows
    for (const evaluationId of this.activeEvaluations.keys()) {
      await this.agentCoordinator.cancelWorkflow(evaluationId);
    }
    
    // Shutdown components
    await this.agentCoordinator.shutdown();
    await this.queueManager.shutdown();
    
    // Unsubscribe from messages
    await this.messageBus.unsubscribe(MessageType.EVALUATION_COMPLETE, this);
    await this.messageBus.unsubscribe(MessageType.EVALUATION_ERROR, this);
    await this.messageBus.unsubscribe(MessageType.EVALUATION_PROGRESS, this);
    
    this.removeAllListeners();
    console.log('Orchestrator Service shutdown complete');
  }

  // Test utility method to reset state
  resetState(): void {
    this.activeEvaluations.clear();
    this.evaluationResults.clear();
    this.metrics = {
      totalEvaluations: 0,
      activeEvaluations: 0,
      completedEvaluations: 0,
      failedEvaluations: 0,
      averageProcessingTime: 0,
      averageScore: 0,
      agentSuccessRates: {},
      throughput: 0
    };
    
    // Also reset repository and queue state for clean test environment
    try {
      // Reset repositories if they're in-memory implementations
      (evaluationRepository as any).resetState?.();
      (agentResultRepository as any).resetState?.();
      
      // Reset queue manager state
      this.queueManager.resetState?.();
    } catch (e) {
      // Ignore if components don't have resetState method
    }
  }
}