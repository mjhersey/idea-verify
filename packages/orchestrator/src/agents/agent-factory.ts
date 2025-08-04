/**
 * Agent Factory - Creates and manages agent instances
 */

import { AgentType } from '@ai-validation/shared';
import { BaseAgent } from './types.js';
import { MarketResearchAgent } from './market-research-agent.js';
import { CompetitiveAnalysisAgent } from './competitive-analysis-agent.js';
import { CustomerResearchAgent } from './customer-research-agent.js';
import { TechnicalFeasibilityAgent } from './technical-feasibility-agent.js';
import { FinancialAnalysisAgent } from './financial-analysis-agent.js';

export class AgentFactory {
  private static agents: Map<AgentType, BaseAgent> = new Map();

  static getAgent(agentType: AgentType): BaseAgent {
    if (!this.agents.has(agentType)) {
      this.agents.set(agentType, this.createAgent(agentType));
    }
    
    return this.agents.get(agentType)!;
  }

  static getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  static getAvailableAgentTypes(): AgentType[] {
    return [
      'market-research',
      'competitive-analysis',
      'customer-research',
      'technical-feasibility',
      'financial-analysis'
    ];
  }

  static isAgentSupported(agentType: AgentType): boolean {
    return this.getAvailableAgentTypes().includes(agentType);
  }

  static getSupportedAgents(): Array<{type: AgentType, name: string, description: string}> {
    return this.getAvailableAgentTypes().map(agentType => {
      const agent = this.getAgent(agentType);
      return {
        type: agentType,
        name: agent.getName(),
        description: agent.getDescription()
      };
    });
  }

  private static createAgent(agentType: AgentType): BaseAgent {
    switch (agentType) {
      case 'market-research':
        return new MarketResearchAgent();
      
      case 'competitive-analysis':
        return new CompetitiveAnalysisAgent();
      
      case 'customer-research':
        return new CustomerResearchAgent();
      
      case 'technical-feasibility':
        return new TechnicalFeasibilityAgent();
      
      case 'financial-analysis':
        return new FinancialAnalysisAgent();
      
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  // Test utility method to reset agent cache
  static resetCache(): void {
    this.agents.clear();
  }
}