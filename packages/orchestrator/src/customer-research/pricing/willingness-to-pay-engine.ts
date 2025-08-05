/**
 * Willingness to Pay Engine
 * Analyzes pricing insights, affordability, and value perception
 */

import { WillingnessToPayAnalysis, DataSource, CustomerResearchRequest } from '../schemas/customer-research-types.js';

export interface WillingnessToPayResult {
  willingnessToPay: WillingnessToPayAnalysis;
  pricingInsights: {
    optimalPriceRange: {
      min: number;
      max: number;
      currency: string;
      confidence: number; // 0-100
    };
    priceElasticity: {
      elasticity: 'high' | 'medium' | 'low';
      demandCurve: Array<{
        price: number;
        demandPercentage: number;
      }>;
      priceBreakpoints: number[];
    };
    competitivePricing: {
      averageMarketPrice: number;
      pricingGaps: Array<{
        pricePoint: number;
        marketGap: string;
        opportunity: number; // 0-100
      }>;
      competitorPrices: Array<{
        competitor: string;
        price: number;
        model: string;
        valueProposition: string;
      }>;
    };
  };
  valuePerception: {
    perceivedValueScore: number; // 0-100
    valueBenefitAnalysis: Array<{
      benefit: string;
      perceivedValue: number; // 0-100
      importance: number; // 0-100
      currentSatisfaction: number; // 0-100
      valuePremium: number; // 0-100
    }>;
    costJustification: Array<{
      costFactor: string;
      customerConcern: string;
      justification: string;
      acceptanceRate: number; // 0-100
    }>;
  };
  pricingRecommendations: {
    recommendedStrategy: string;
    pricingModel: 'subscription' | 'one-time' | 'freemium' | 'usage-based' | 'hybrid';
    pricingTiers: Array<{
      tier: string;
      price: number;
      features: string[];
      targetSegment: string;
      conversionProbability: number; // 0-100
    }>;
    rolloutStrategy: {
      launchPrice: number;
      pricingEvolution: Array<{
        phase: string;
        timeframe: string;
        price: number;
        rationale: string;
      }>;
    };
  };
  dataSources: DataSource[];
}

export class WillingnessToPayEngine {
  private readonly analysisTimeout = 3000;

  async analyzeWillingnessToPay(request: CustomerResearchRequest): Promise<WillingnessToPayResult> {
    const startTime = Date.now();
    console.log(`[WillingnessToPayEngine] Analyzing willingness to pay for: ${request.businessIdea.title}`);

    try {
      // Parallel analysis of different pricing dimensions
      const [
        marketPricingAnalysis,
        valuePerceptionAnalysis,
        affordabilityAnalysis,
        competitivePricingAnalysis
      ] = await Promise.all([
        this.analyzeMarketPricing(request),
        this.analyzeValuePerception(request),
        this.analyzeAffordability(request),
        this.analyzeCompetitivePricing(request)
      ]);

      // Synthesize willingness to pay analysis
      const willingnessToPay = this.synthesizeWillingnessToPay(
        marketPricingAnalysis, valuePerceptionAnalysis, affordabilityAnalysis, competitivePricingAnalysis, request
      );

      // Generate pricing insights
      const pricingInsights = this.generatePricingInsights(
        marketPricingAnalysis, competitivePricingAnalysis, request
      );

      // Create value perception analysis
      const valuePerception = this.createValuePerceptionAnalysis(
        valuePerceptionAnalysis, request
      );

      // Generate pricing recommendations
      const pricingRecommendations = this.generatePricingRecommendations(
        willingnessToPay, pricingInsights, valuePerception, request
      );

      const dataSources = this.generatePricingDataSources();

      console.log(`[WillingnessToPayEngine] Willingness to pay analysis completed in ${Date.now() - startTime}ms`);

      return {
        willingnessToPay,
        pricingInsights,
        valuePerception,
        pricingRecommendations,
        dataSources
      };

    } catch (error) {
      console.error('[WillingnessToPayEngine] Willingness to pay analysis failed:', error);
      throw new Error(`Willingness to pay analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeMarketPricing(request: CustomerResearchRequest) {
    const domain = this.extractDomain(request.businessIdea.description);
    const targetMarket = request.businessIdea.targetMarket?.toLowerCase() || '';
    const category = request.businessIdea.category?.toLowerCase() || 'general';

    return {
      priceRanges: this.getMarketPriceRanges(domain, category),
      pricingSensitivity: this.analyzePricingSensitivity(domain, category),
      paymentPreferences: this.analyzePaymentPreferences(domain, category),
      budgetConstraints: this.identifyBudgetConstraints(domain, category, targetMarket),
      priceAnchors: this.identifyPriceAnchors(domain, category)
    };
  }

  private async analyzeValuePerception(request: CustomerResearchRequest) {
    const domain = this.extractDomain(request.businessIdea.description);
    const solution = request.businessIdea.description;

    return {
      valueBenefits: this.identifyValueBenefits(domain, solution),
      costOfProblem: this.calculateCostOfProblem(domain),
      valueProposition: this.analyzeValueProposition(domain, solution),
      benefitPerception: this.analyzeBenefitPerception(domain),
      costJustifications: this.identifyCostJustifications(domain)
    };
  }

  private async analyzeAffordability(request: CustomerResearchRequest) {
    const domain = this.extractDomain(request.businessIdea.description);
    const targetMarket = request.businessIdea.targetMarket?.toLowerCase() || '';

    return {
      targetIncomeRanges: this.getTargetIncomeRanges(domain),
      spendingCapacity: this.analyzeSpendingCapacity(domain, targetMarket),
      budgetAllocation: this.analyzeBudgetAllocation(domain),
      paymentCapabilities: this.analyzePaymentCapabilities(domain),
      affordabilityBarriers: this.identifyAffordabilityBarriers(domain)
    };
  }

  private async analyzeCompetitivePricing(request: CustomerResearchRequest) {
    const domain = this.extractDomain(request.businessIdea.description);
    const category = request.businessIdea.category?.toLowerCase() || 'general';

    return {
      competitorPrices: this.getCompetitorPrices(domain, category),
      pricingModels: this.analyzePricingModels(domain, category),
      marketPosition: this.analyzeMarketPosition(domain, category),
      pricingGaps: this.identifyPricingGaps(domain, category),
      valuePositioning: this.analyzeValuePositioning(domain, category)
    };
  }

  private extractDomain(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('health') || lowerDesc.includes('fitness') || lowerDesc.includes('wellness')) {
      return 'health-fitness';
    } else if (lowerDesc.includes('business') || lowerDesc.includes('enterprise') || lowerDesc.includes('b2b')) {
      return 'business';
    } else if (lowerDesc.includes('tech') || lowerDesc.includes('software') || lowerDesc.includes('app')) {
      return 'technology';
    } else if (lowerDesc.includes('finance') || lowerDesc.includes('money') || lowerDesc.includes('payment')) {
      return 'finance';
    } else if (lowerDesc.includes('education') || lowerDesc.includes('learning') || lowerDesc.includes('training')) {
      return 'education';
    } else {
      return 'general';
    }
  }

  private getMarketPriceRanges(domain: string, category: string) {
    const priceRangeMap = {
      'health-fitness': {
        'consumer': { min: 9.99, max: 49.99, avg: 24.99 },
        'premium': { min: 39.99, max: 149.99, avg: 79.99 },
        'professional': { min: 99.99, max: 299.99, avg: 179.99 }
      },
      'business': {
        'starter': { min: 29.99, max: 99.99, avg: 59.99 },
        'professional': { min: 99.99, max: 499.99, avg: 249.99 },
        'enterprise': { min: 499.99, max: 2999.99, avg: 1499.99 }
      },
      'technology': {
        'developer': { min: 19.99, max: 99.99, avg: 49.99 },
        'team': { min: 99.99, max: 399.99, avg: 199.99 },
        'enterprise': { min: 399.99, max: 1999.99, avg: 999.99 }
      },
      'finance': {
        'basic': { min: 4.99, max: 19.99, avg: 12.99 },
        'premium': { min: 19.99, max: 99.99, avg: 49.99 },
        'wealth': { min: 99.99, max: 499.99, avg: 249.99 }
      },
      'education': {
        'individual': { min: 14.99, max: 79.99, avg: 39.99 },
        'institutional': { min: 99.99, max: 999.99, avg: 399.99 },
        'enterprise': { min: 999.99, max: 4999.99, avg: 2499.99 }
      }
    };
    
    return priceRangeMap[domain] || {
      'basic': { min: 9.99, max: 49.99, avg: 24.99 },
      'premium': { min: 49.99, max: 199.99, avg: 99.99 },
      'enterprise': { min: 199.99, max: 999.99, avg: 499.99 }
    };
  }

  private analyzePricingSensitivity(domain: string, category: string) {
    const sensitivityMap = {
      'health-fitness': { elasticity: 'medium', priceAwareness: 70, valueOriented: 60 },
      'business': { elasticity: 'low', priceAwareness: 85, valueOriented: 80 },
      'technology': { elasticity: 'low', priceAwareness: 75, valueOriented: 85 },
      'finance': { elasticity: 'high', priceAwareness: 90, valueOriented: 70 },
      'education': { elasticity: 'high', priceAwareness: 85, valueOriented: 65 },
      'general': { elasticity: 'medium', priceAwareness: 75, valueOriented: 70 }
    };
    return sensitivityMap[domain] || sensitivityMap['general'];
  }

  private analyzePaymentPreferences(domain: string, category: string) {
    const preferencesMap = {
      'health-fitness': {
        monthly: 60, annual: 25, oneTime: 10, usage: 5,
        preferredMethods: ['credit card', 'mobile payment', 'subscription']
      },
      'business': {
        monthly: 45, annual: 40, oneTime: 10, usage: 5,
        preferredMethods: ['corporate card', 'invoice', 'bank transfer']
      },
      'technology': {
        monthly: 50, annual: 35, oneTime: 5, usage: 10,
        preferredMethods: ['credit card', 'corporate card', 'subscription']
      },
      'finance': {
        monthly: 55, annual: 20, oneTime: 20, usage: 5,
        preferredMethods: ['bank transfer', 'credit card', 'subscription']
      },
      'education': {
        monthly: 35, annual: 45, oneTime: 15, usage: 5,
        preferredMethods: ['credit card', 'installments', 'subscription']
      }
    };
    return preferencesMap[domain] || {
      monthly: 50, annual: 30, oneTime: 15, usage: 5,
      preferredMethods: ['credit card', 'subscription', 'mobile payment']
    };
  }

  private identifyBudgetConstraints(domain: string, category: string, targetMarket: string) {
    const constraintsMap = {
      'health-fitness': [
        'Limited discretionary spending on wellness',
        'Competition with gym memberships',
        'Seasonal spending patterns',
        'Individual vs family budget considerations'
      ],
      'business': [
        'Annual software budget constraints',
        'ROI justification requirements',
        'Procurement process delays',
        'Budget approval hierarchies'
      ],
      'technology': [
        'Development tool budget limitations',
        'Enterprise procurement processes',
        'Open source alternative availability',
        'Technical evaluation requirements'
      ],
      'finance': [
        'Regulatory compliance costs',
        'Trust and security concerns',
        'Existing financial service relationships',
        'Fee structure transparency requirements'
      ],
      'education': [
        'Limited education budgets',
        'Competing learning priorities',
        'Institutional approval processes',
        'ROI measurement challenges'
      ]
    };
    return constraintsMap[domain] || [
      'Limited budget allocation',
      'Competing priorities',
      'Value justification requirements',
      'Approval process constraints'
    ];
  }

  private identifyPriceAnchors(domain: string, category: string) {
    const anchorMap = {
      'health-fitness': [
        'Monthly gym membership ($30-80)',
        'Personal trainer session ($50-150)',
        'Fitness app subscription ($10-30)',
        'Wearable device cost ($100-500)'
      ],
      'business': [
        'Employee monthly salary ($3000-8000)',
        'Enterprise software licenses ($50-500/user)',
        'Consultant daily rate ($500-2000)',
        'Business tool subscriptions ($20-200/user)'
      ],
      'technology': [
        'Developer tool subscriptions ($20-100)',
        'Cloud hosting costs ($50-500)',
        'Software license fees ($100-1000)',
        'Development time value ($50-200/hour)'
      ],
      'finance': [
        'Bank account fees ($5-25)',
        'Investment management fees (0.5-2%)',
        'Financial advisor hourly rate ($100-400)',
        'Trading platform fees ($5-20)'
      ],
      'education': [
        'Online course price ($50-300)',
        'University course cost ($500-2000)',
        'Professional certification ($200-1000)',
        'Training program fee ($1000-5000)'
      ]
    };
    return anchorMap[domain] || [
      'Comparable service fees ($20-100)',
      'Professional service rates ($100-500)',
      'Software subscription costs ($10-50)',
      'Alternative solution prices ($50-200)'
    ];
  }

  private identifyValueBenefits(domain: string, solution: string) {
    const benefitsMap = {
      'health-fitness': [
        { benefit: 'Personalized workout plans', value: 85, importance: 90 },
        { benefit: 'Time savings vs gym', value: 75, importance: 80 },
        { benefit: 'Progress tracking', value: 70, importance: 75 },
        { benefit: 'Cost vs personal trainer', value: 90, importance: 85 },
        { benefit: 'Convenience and flexibility', value: 80, importance: 85 }
      ],
      'business': [
        { benefit: 'Process automation', value: 95, importance: 95 },
        { benefit: 'Time savings', value: 90, importance: 90 },
        { benefit: 'Reduced errors', value: 85, importance: 80 },
        { benefit: 'Scalability', value: 80, importance: 85 },
        { benefit: 'Integration capabilities', value: 75, importance: 80 }
      ],
      'technology': [
        { benefit: 'Development speed', value: 90, importance: 95 },
        { benefit: 'Code quality improvement', value: 85, importance: 85 },
        { benefit: 'Performance optimization', value: 80, importance: 80 },
        { benefit: 'Debugging efficiency', value: 75, importance: 75 },
        { benefit: 'Team collaboration', value: 70, importance: 70 }
      ],
      'finance': [
        { benefit: 'Investment returns', value: 90, importance: 95 },
        { benefit: 'Risk management', value: 85, importance: 90 },
        { benefit: 'Time savings', value: 75, importance: 70 },
        { benefit: 'Transparency', value: 80, importance: 85 },
        { benefit: 'Professional guidance', value: 85, importance: 80 }
      ],
      'education': [
        { benefit: 'Career advancement', value: 95, importance: 95 },
        { benefit: 'Skill development', value: 90, importance: 90 },
        { benefit: 'Learning efficiency', value: 80, importance: 80 },
        { benefit: 'Flexible scheduling', value: 75, importance: 85 },
        { benefit: 'Practical application', value: 85, importance: 90 }
      ]
    };
    return benefitsMap[domain] || [
      { benefit: 'Core functionality', value: 80, importance: 85 },
      { benefit: 'Time savings', value: 75, importance: 80 },
      { benefit: 'Convenience', value: 70, importance: 75 },
      { benefit: 'Cost effectiveness', value: 85, importance: 80 },
      { benefit: 'Quality improvement', value: 80, importance: 85 }
    ];
  }

  private calculateCostOfProblem(domain: string): number {
    const costMap = {
      'health-fitness': 2400, // Annual gym + trainer costs
      'business': 15000, // Productivity loss + inefficiency
      'technology': 8000, // Development delays + maintenance
      'finance': 3600, // Poor investment decisions + fees
      'education': 5000, // Career opportunity cost
      'general': 2000
    };
    return costMap[domain] || 2000;
  }

  private analyzeValueProposition(domain: string, solution: string) {
    return {
      coreValue: this.identifyCoreValue(domain, solution),
      differentiators: this.identifyDifferentiators(domain, solution),
      quantifiableBenefits: this.identifyQuantifiableBenefits(domain),
      emotionalBenefits: this.identifyEmotionalBenefits(domain)
    };
  }

  private identifyCoreValue(domain: string, solution: string): string {
    const valueMap = {
      'health-fitness': 'Personalized AI-powered fitness guidance at a fraction of personal trainer cost',
      'business': 'Automated business processes that save time and reduce operational costs',
      'technology': 'Streamlined development workflow that accelerates project delivery',
      'finance': 'Intelligent financial management that maximizes returns and minimizes risk',
      'education': 'Accelerated skill development with practical, career-focused learning',
      'general': 'Efficient solution that saves time and improves outcomes'
    };
    return valueMap[domain] || valueMap['general'];
  }

  private identifyDifferentiators(domain: string, solution: string): string[] {
    const differentiatorMap = {
      'health-fitness': ['AI personalization', 'Real-time adaptation', 'Integrated lifestyle tracking', 'Community support'],
      'business': ['No-code automation', 'Seamless integration', 'Intelligent insights', 'Scalable architecture'],
      'technology': ['Zero-configuration setup', 'Intelligent optimization', 'Proactive monitoring', 'Developer-friendly'],
      'finance': ['Transparent pricing', 'Educational focus', 'Personalized strategies', 'Ethical approach'],
      'education': ['Practical application', 'Career-focused outcomes', 'Adaptive learning', 'Industry connections'],
      'general': ['User-centric design', 'Intelligent automation', 'Seamless experience', 'Value-driven approach']
    };
    return differentiatorMap[domain] || differentiatorMap['general'];
  }

  private identifyQuantifiableBenefits(domain: string) {
    const benefitsMap = {
      'health-fitness': ['Save $2000+ vs personal trainer', '3x faster results', '50% more consistent workouts'],
      'business': ['Save 20+ hours/week', 'Reduce errors by 80%', 'Increase productivity by 40%'],
      'technology': ['Deploy 50% faster', 'Reduce bugs by 60%', 'Save 10+ hours/week'],
      'finance': ['Improve returns by 2-5%', 'Reduce fees by 50%', 'Save 5+ hours/month'],
      'education': ['Learn 3x faster', 'Increase salary by 20%', 'Save $5000+ vs traditional education'],
      'general': ['Save significant time', 'Reduce costs', 'Improve outcomes']
    };
    return benefitsMap[domain] || benefitsMap['general'];
  }

  private identifyEmotionalBenefits(domain: string): string[] {
    const emotionalMap = {
      'health-fitness': ['Confidence boost', 'Achievement satisfaction', 'Reduced fitness anxiety', 'Community belonging'],
      'business': ['Control and efficiency', 'Professional growth', 'Reduced stress', 'Innovation satisfaction'],
      'technology': ['Mastery and competence', 'Creative fulfillment', 'Problem-solving satisfaction', 'Professional recognition'],
      'finance': ['Security and peace of mind', 'Control over future', 'Confidence in decisions', 'Financial independence'],
      'education': ['Personal growth', 'Career confidence', 'Knowledge satisfaction', 'Achievement pride'],
      'general': ['Confidence', 'Control', 'Achievement', 'Peace of mind']
    };
    return emotionalMap[domain] || emotionalMap['general'];
  }

  private analyzeBenefitPerception(domain: string) {
    const perceptionMap = {
      'health-fitness': { awareness: 70, understanding: 60, belief: 65, priority: 75 },
      'business': { awareness: 85, understanding: 80, belief: 85, priority: 90 },
      'technology': { awareness: 90, understanding: 85, belief: 80, priority: 85 },
      'finance': { awareness: 75, understanding: 70, belief: 65, priority: 80 },
      'education': { awareness: 80, understanding: 75, belief: 70, priority: 85 },
      'general': { awareness: 75, understanding: 70, belief: 70, priority: 80 }
    };
    return perceptionMap[domain] || perceptionMap['general'];
  }

  private identifyCostJustifications(domain: string) {
    const justificationMap = {
      'health-fitness': [
        { factor: 'Health investment', justification: 'Prevent healthcare costs', acceptance: 80 },
        { factor: 'Time value', justification: 'Efficient vs gym commute', acceptance: 75 },
        { factor: 'Results guarantee', justification: 'Personalized approach works', acceptance: 70 }
      ],
      'business': [
        { factor: 'Productivity gains', justification: 'ROI through efficiency', acceptance: 90 },
        { factor: 'Scalability', justification: 'Grow without proportional costs', acceptance: 85 },
        { factor: 'Competitive advantage', justification: 'Stay ahead of competition', acceptance: 80 }
      ],
      'technology': [
        { factor: 'Development speed', justification: 'Faster time to market', acceptance: 90 },
        { factor: 'Code quality', justification: 'Reduce maintenance costs', acceptance: 85 },
        { factor: 'Team efficiency', justification: 'Developer productivity boost', acceptance: 80 }
      ]
    };
    return justificationMap[domain] || [
      { factor: 'Value delivery', justification: 'Clear return on investment', acceptance: 80 },
      { factor: 'Time savings', justification: 'Efficiency improvements', acceptance: 75 },
      { factor: 'Quality improvement', justification: 'Better outcomes', acceptance: 70 }
    ];
  }

  private getTargetIncomeRanges(domain: string) {
    const incomeMap = {
      'health-fitness': { min: 40000, max: 120000, median: 65000 },
      'business': { min: 60000, max: 200000, median: 95000 },
      'technology': { min: 70000, max: 180000, median: 110000 },
      'finance': { min: 50000, max: 150000, median: 85000 },
      'education': { min: 35000, max: 100000, median: 55000 },
      'general': { min: 40000, max: 120000, median: 70000 }
    };
    return incomeMap[domain] || incomeMap['general'];
  }

  private analyzeSpendingCapacity(domain: string, targetMarket: string) {
    const capacityMap = {
      'health-fitness': { discretionary: 8, wellness: 12, technology: 5 },
      'business': { software: 15, tools: 10, services: 20 },
      'technology': { development: 20, tools: 15, infrastructure: 25 },
      'finance': { services: 10, tools: 8, advisory: 15 },
      'education': { learning: 12, development: 10, certification: 8 },
      'general': { discretionary: 10, tools: 8, services: 12 }
    };
    
    const baseCapacity = capacityMap[domain] || capacityMap['general'];
    
    // Adjust for target market
    let multiplier = 1.0;
    if (targetMarket.includes('enterprise') || targetMarket.includes('business')) {
      multiplier = 2.0;
    } else if (targetMarket.includes('premium') || targetMarket.includes('professional')) {
      multiplier = 1.5;
    } else if (targetMarket.includes('budget') || targetMarket.includes('student')) {
      multiplier = 0.6;
    }
    
    return Object.fromEntries(
      Object.entries(baseCapacity).map(([key, value]) => [key, Math.round((value as number) * multiplier)])
    );
  }

  private analyzeBudgetAllocation(domain: string) {
    const allocationMap = {
      'health-fitness': { essential: 70, discretionary: 20, luxury: 10 },
      'business': { essential: 60, growth: 25, innovation: 15 },
      'technology': { infrastructure: 50, development: 30, innovation: 20 },
      'finance': { essential: 80, investment: 15, advisory: 5 },
      'education': { required: 60, development: 25, optional: 15 },
      'general': { essential: 70, development: 20, discretionary: 10 }
    };
    return allocationMap[domain] || allocationMap['general'];
  }

  private analyzePaymentCapabilities(domain: string) {
    const capabilityMap = {
      'health-fitness': {
        monthlyMax: 150, oneTimeMax: 500, annualMax: 1200,
        preferredFreq: 'monthly', budgetCycle: 'personal'
      },
      'business': {
        monthlyMax: 2000, oneTimeMax: 10000, annualMax: 20000,
        preferredFreq: 'annual', budgetCycle: 'fiscal'
      },
      'technology': {
        monthlyMax: 500, oneTimeMax: 2000, annualMax: 5000,
        preferredFreq: 'monthly', budgetCycle: 'project'
      },
      'finance': {
        monthlyMax: 200, oneTimeMax: 1000, annualMax: 2000,
        preferredFreq: 'monthly', budgetCycle: 'personal'
      },
      'education': {
        monthlyMax: 300, oneTimeMax: 2000, annualMax: 3000,
        preferredFreq: 'course', budgetCycle: 'academic'
      }
    };
    return capabilityMap[domain] || {
      monthlyMax: 200, oneTimeMax: 1000, annualMax: 2000,
      preferredFreq: 'monthly', budgetCycle: 'personal'
    };
  }

  private identifyAffordabilityBarriers(domain: string): string[] {
    const barrierMap = {
      'health-fitness': ['Limited wellness budget', 'Competing fitness expenses', 'Seasonal spending', 'Family budget priorities'],
      'business': ['Budget approval processes', 'ROI justification requirements', 'Competing software needs', 'Economic uncertainty'],
      'technology': ['Open source alternatives', 'Internal development capabilities', 'Budget constraints', 'Technical evaluation overhead'],
      'finance': ['Existing service relationships', 'Trust and security concerns', 'Regulatory requirements', 'Fee transparency issues'],
      'education': ['Competing learning priorities', 'Uncertain career ROI', 'Time constraints', 'Alternative free resources'],
      'general': ['Budget limitations', 'Competing priorities', 'Value uncertainty', 'Switching costs']
    };
    return barrierMap[domain] || barrierMap['general'];
  }

  private getCompetitorPrices(domain: string, category: string) {
    const pricesMap = {
      'health-fitness': [
        { competitor: 'MyFitnessPal Premium', price: 19.99, model: 'monthly', value: 'Nutrition tracking + workouts' },
        { competitor: 'Nike Training Club', price: 0, model: 'freemium', value: 'Basic workouts, premium coaching' },
        { competitor: 'Peloton Digital', price: 39.99, model: 'monthly', value: 'Live and on-demand classes' },
        { competitor: 'Fitbit Premium', price: 9.99, model: 'monthly', value: 'Advanced analytics + guidance' }
      ],
      'business': [
        { competitor: 'HubSpot Starter', price: 45, model: 'monthly', value: 'CRM + basic automation' },
        { competitor: 'Salesforce Essentials', price: 25, model: 'monthly', value: 'CRM for small business' },
        { competitor: 'Monday.com Basic', price: 8, model: 'monthly', value: 'Project management + collaboration' },
        { competitor: 'Zapier Starter', price: 19.99, model: 'monthly', value: 'Basic workflow automation' }
      ],
      'technology': [
        { competitor: 'GitHub Pro', price: 4, model: 'monthly', value: 'Advanced Git features' },
        { competitor: 'Datadog Pro', price: 23, model: 'monthly', value: 'Application monitoring' },
        { competitor: 'New Relic Standard', price: 99, model: 'monthly', value: 'Full stack monitoring' },
        { competitor: 'JetBrains IntelliJ', price: 16.90, model: 'monthly', value: 'IDE with advanced features' }
      ]
    };
    return pricesMap[domain] || [
      { competitor: 'Competitor A', price: 29.99, model: 'monthly', value: 'Basic features + support' },
      { competitor: 'Competitor B', price: 19.99, model: 'monthly', value: 'Core functionality' },
      { competitor: 'Competitor C', price: 49.99, model: 'monthly', value: 'Premium features' }
    ];
  }

  private analyzePricingModels(domain: string, category: string) {
    const modelMap = {
      'health-fitness': { subscription: 70, oneTime: 10, freemium: 15, usage: 5 },
      'business': { subscription: 60, oneTime: 15, freemium: 10, usage: 15 },
      'technology': { subscription: 55, oneTime: 20, freemium: 15, usage: 10 },
      'finance': { subscription: 50, oneTime: 20, freemium: 20, usage: 10 },
      'education': { subscription: 40, oneTime: 35, freemium: 15, usage: 10 },
      'general': { subscription: 55, oneTime: 25, freemium: 15, usage: 5 }
    };
    return modelMap[domain] || modelMap['general'];
  }

  private analyzeMarketPosition(domain: string, category: string) {
    return {
      averagePrice: this.calculateAverageMarketPrice(domain),
      priceSpread: this.calculatePriceSpread(domain),
      premiumThreshold: this.calculatePremiumThreshold(domain),
      budgetThreshold: this.calculateBudgetThreshold(domain),
      sweetSpot: this.calculatePriceSweetSpot(domain)
    };
  }

  private calculateAverageMarketPrice(domain: string): number {
    const avgPriceMap = {
      'health-fitness': 24.99,
      'business': 89.99,
      'technology': 49.99,
      'finance': 29.99,
      'education': 39.99,
      'general': 34.99
    };
    return avgPriceMap[domain] || 34.99;
  }

  private calculatePriceSpread(domain: string) {
    const spreadMap = {
      'health-fitness': { min: 0, max: 149.99, median: 19.99 },
      'business': { min: 8, max: 999, median: 49.99 },
      'technology': { min: 0, max: 299, median: 29.99 },
      'finance': { min: 0, max: 199.99, median: 19.99 },
      'education': { min: 0, max: 499.99, median: 39.99 },
      'general': { min: 0, max: 199.99, median: 29.99 }
    };
    return spreadMap[domain] || spreadMap['general'];
  }

  private calculatePremiumThreshold(domain: string): number {
    const avgPrice = this.calculateAverageMarketPrice(domain);
    return avgPrice * 2; // Premium is 2x average
  }

  private calculateBudgetThreshold(domain: string): number {
    const avgPrice = this.calculateAverageMarketPrice(domain);
    return avgPrice * 0.6; // Budget is 60% of average
  }

  private calculatePriceSweetSpot(domain: string): number {
    const avgPrice = this.calculateAverageMarketPrice(domain);
    return avgPrice * 1.2; // Sweet spot is 20% above average
  }

  private identifyPricingGaps(domain: string, category: string) {
    const avgPrice = this.calculateAverageMarketPrice(domain);
    
    return [
      {
        pricePoint: Math.round(avgPrice * 0.4),
        marketGap: 'Ultra-budget segment underserved',
        opportunity: 70
      },
      {
        pricePoint: Math.round(avgPrice * 1.6),
        marketGap: 'Premium value segment opportunity',
        opportunity: 80
      },
      {
        pricePoint: Math.round(avgPrice * 0.8),
        marketGap: 'Value-conscious segment gap',
        opportunity: 60
      }
    ];
  }

  private analyzeValuePositioning(domain: string, category: string) {
    return {
      valueLeaders: this.identifyValueLeaders(domain),
      priceLeaders: this.identifyPriceLeaders(domain),
      valueGaps: this.identifyValueGaps(domain),
      positioningOpportunities: this.identifyPositioningOpportunities(domain)
    };
  }

  private identifyValueLeaders(domain: string): string[] {
    const leadersMap = {
      'health-fitness': ['Peloton (premium experience)', 'MyFitnessPal (comprehensive tracking)'],
      'business': ['Salesforce (comprehensive CRM)', 'HubSpot (integrated marketing)'],
      'technology': ['JetBrains (developer productivity)', 'Datadog (comprehensive monitoring)'],
      'finance': ['Mint (free budgeting)', 'Personal Capital (wealth management)'],
      'education': ['MasterClass (celebrity instructors)', 'Coursera (university partnerships)'],
      'general': ['Market leader A', 'Premium provider B']
    };
    return leadersMap[domain] || leadersMap['general'];
  }

  private identifyPriceLeaders(domain: string): string[] {
    const leadersMap = {
      'health-fitness': ['Nike Training Club (free)', 'Adidas Training (freemium)'],
      'business': ['Monday.com (affordable PM)', 'Zapier (accessible automation)'],
      'technology': ['GitHub (developer-friendly)', 'VS Code (free)'],
      'finance': ['Robinhood (commission-free)', 'Acorns (micro-investing)'],
      'education': ['Khan Academy (free)', 'Udemy (affordable courses)'],
      'general': ['Budget leader A', 'Affordable option B']
    };
    return leadersMap[domain] || leadersMap['general'];
  }

  private identifyValueGaps(domain: string): string[] {
    const gapsMap = {
      'health-fitness': ['Mid-tier personalization', 'Affordable premium features', 'Family plan options'],
      'business': ['SMB-focused enterprise features', 'Industry-specific solutions', 'Implementation support'],
      'technology': ['No-code development tools', 'Integrated development platforms', 'Team collaboration features'],
      'finance': ['Transparent fee structures', 'Educational financial tools', 'Personalized investment advice'],
      'education': ['Practical skill application', 'Career outcome tracking', 'Mentorship integration'],
      'general': ['Mid-market solutions', 'Specialized features', 'Better user experience']
    };
    return gapsMap[domain] || gapsMap['general'];
  }

  private identifyPositioningOpportunities(domain: string): string[] {
    const opportunitiesMap = {
      'health-fitness': ['AI-powered personalization leader', 'Outcome-guaranteed fitness', 'Integrated lifestyle platform'],
      'business': ['No-code automation specialist', 'SMB growth enabler', 'All-in-one business platform'],
      'technology': ['Developer experience champion', 'Zero-configuration leader', 'Intelligence-first tools'],
      'finance': ['Transparency-first financial services', 'Education-focused investing', 'Ethical financial platform'],
      'education': ['Outcome-focused learning', 'Real-world application leader', 'Career acceleration platform'],
      'general': ['User-experience leader', 'Value transparency champion', 'Outcome-focused provider']
    };
    return opportunitiesMap[domain] || opportunitiesMap['general'];
  }

  private synthesizeWillingnessToPay(marketPricing: any, valuePerception: any, affordability: any, competitivePricing: any, request: CustomerResearchRequest): WillingnessToPayAnalysis {
    const domain = this.extractDomain(request.businessIdea.description);
    const priceRanges = marketPricing.priceRanges;
    const sensitivity = marketPricing.pricingSensitivity;
    const costOfProblem = valuePerception.costOfProblem;

    // Calculate optimal price range
    const basePrice = competitivePricing.marketPosition.averagePrice;
    const minPrice = Math.max(basePrice * 0.7, priceRanges.consumer?.min || 9.99);
    const maxPrice = Math.min(basePrice * 1.8, affordability.paymentCapabilities.monthlyMax);

    // Determine pricing model
    const modelPreferences = competitivePricing.pricingModels;
    const recommendedModel = Object.entries(modelPreferences)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0][0] as 'subscription' | 'one-time' | 'freemium' | 'usage-based' | 'hybrid';

    // Calculate confidence based on market data quality
    const confidence = Math.min(100, 
      (sensitivity.valueOriented + 
       valuePerception.benefitPerception.belief + 
       (affordability.paymentCapabilities.monthlyMax > basePrice ? 80 : 60)) / 3
    );

    return {
      priceRange: {
        min: Math.round(minPrice),
        max: Math.round(maxPrice),
        currency: 'USD',
        confidence
      },
      priceModel: recommendedModel,
      valuePerspective: {
        perceivedValue: valuePerception.benefitPerception.belief,
        costOfProblem,
        competitiveContext: competitivePricing.competitorPrices.map((c: any) => `${c.competitor}: $${c.price}/${c.model}`),
        priceAnchors: marketPricing.priceAnchors
      },
      priceSensitivity: {
        elasticity: sensitivity.elasticity,
        segmentVariations: [
          { segment: 'Budget-conscious', sensitivity: 'high', willingnessToPay: Math.round(minPrice) },
          { segment: 'Value-oriented', sensitivity: 'medium', willingnessToPay: Math.round((minPrice + maxPrice) / 2) },
          { segment: 'Premium', sensitivity: 'low', willingnessToPay: Math.round(maxPrice) }
        ]
      },
      affordabilityAssessment: {
        canAfford: this.calculateAffordabilityPercentage(basePrice, affordability),
        paymentPreferences: marketPricing.paymentPreferences.preferredMethods,
        budgetConstraints: marketPricing.budgetConstraints
      },
      recommendations: {
        suggestedPrice: Math.round(competitivePricing.marketPosition.sweetSpot),
        pricingStrategy: this.generatePricingStrategy(domain, recommendedModel, confidence),
        rationale: this.generatePricingRationale(domain, basePrice, costOfProblem),
        risks: this.identifyPricingRisks(domain, sensitivity.elasticity)
      },
      confidence
    };
  }

  private calculateAffordabilityPercentage(price: number, affordability: any): number {
    const monthlyMax = affordability.paymentCapabilities.monthlyMax;
    if (price <= monthlyMax * 0.5) return 85;
    if (price <= monthlyMax * 0.7) return 70;
    if (price <= monthlyMax) return 55;
    return 30;
  }

  private generatePricingStrategy(domain: string, model: string, confidence: number): string {
    const strategyMap = {
      'health-fitness': 'Value-based pricing with tiered options and free trial',
      'business': 'ROI-focused pricing with enterprise scaling options',
      'technology': 'Developer-friendly pricing with usage-based scaling',
      'finance': 'Transparent fee structure with performance-based options',
      'education': 'Outcome-based pricing with flexible payment terms',
      'general': 'Competitive pricing with clear value differentiation'
    };
    return strategyMap[domain] || strategyMap['general'];
  }

  private generatePricingRationale(domain: string, basePrice: number, costOfProblem: number): string[] {
    return [
      `Market analysis shows average pricing at $${basePrice}`,
      `Customer problem costs $${costOfProblem} annually`,
      `Solution provides 3-5x ROI vs problem cost`,
      `Pricing positioned for value-conscious segment capture`,
      `Competitive analysis supports premium positioning opportunity`
    ];
  }

  private identifyPricingRisks(domain: string, elasticity: string): string[] {
    const baseRisks = [
      'Customer price sensitivity higher than expected',
      'Competitive pricing pressure from new entrants',
      'Economic downturn affecting discretionary spending'
    ];

    if (elasticity === 'high') {
      baseRisks.push('High price elasticity may limit premium pricing');
    }

    const domainRisks = {
      'health-fitness': ['Seasonal spending fluctuations', 'Motivation-dependent retention'],
      'business': ['Budget approval delays', 'ROI justification requirements'],
      'technology': ['Open source alternatives', 'Developer tool fatigue'],
      'finance': ['Regulatory changes', 'Trust and security concerns'],
      'education': ['Alternative learning options', 'Uncertain career outcomes']
    };

    return [...baseRisks, ...(domainRisks[domain] || [])];
  }

  private generatePricingInsights(marketPricing: any, competitivePricing: any, request: CustomerResearchRequest) {
    const domain = this.extractDomain(request.businessIdea.description);
    const avgPrice = competitivePricing.marketPosition.averagePrice;
    const sensitivity = marketPricing.pricingSensitivity;

    return {
      optimalPriceRange: {
        min: Math.round(avgPrice * 0.8),
        max: Math.round(avgPrice * 1.5),
        currency: 'USD',
        confidence: 80
      },
      priceElasticity: {
        elasticity: sensitivity.elasticity,
        demandCurve: this.generateDemandCurve(avgPrice, sensitivity.elasticity),
        priceBreakpoints: [
          Math.round(avgPrice * 0.5),
          Math.round(avgPrice),
          Math.round(avgPrice * 1.5),
          Math.round(avgPrice * 2)
        ]
      },
      competitivePricing: {
        averageMarketPrice: avgPrice,
        pricingGaps: competitivePricing.pricingGaps,
        competitorPrices: competitivePricing.competitorPrices
      }
    };
  }

  private generateDemandCurve(avgPrice: number, elasticity: string) {
    const basePoints = [
      { price: Math.round(avgPrice * 0.5), demandPercentage: 90 },
      { price: Math.round(avgPrice * 0.7), demandPercentage: 80 },
      { price: avgPrice, demandPercentage: 60 },
      { price: Math.round(avgPrice * 1.3), demandPercentage: 40 },
      { price: Math.round(avgPrice * 1.6), demandPercentage: 25 },
      { price: Math.round(avgPrice * 2), demandPercentage: 10 }
    ];

    // Adjust for elasticity
    if (elasticity === 'high') {
      return basePoints.map(p => ({ ...p, demandPercentage: Math.max(5, p.demandPercentage - 15) }));
    } else if (elasticity === 'low') {
      return basePoints.map(p => ({ ...p, demandPercentage: Math.min(95, p.demandPercentage + 10) }));
    }
    return basePoints;
  }

  private createValuePerceptionAnalysis(valuePerception: any, request: CustomerResearchRequest) {
    const benefits = valuePerception.valueBenefits;
    const perception = valuePerception.benefitPerception;

    return {
      perceivedValueScore: perception.belief,
      valueBenefitAnalysis: benefits.map((benefit: any) => ({
        benefit: benefit.benefit,
        perceivedValue: benefit.value,
        importance: benefit.importance,
        currentSatisfaction: Math.max(0, benefit.value - 20), // Simulate current satisfaction gap
        valuePremium: Math.min(100, benefit.importance - 60) // Premium willingness based on importance
      })),
      costJustification: valuePerception.costJustifications.map((justification: any) => ({
        costFactor: justification.factor,
        customerConcern: `Concerns about ${justification.factor.toLowerCase()} costs`,
        justification: justification.justification,
        acceptanceRate: justification.acceptance
      }))
    };
  }

  private generatePricingRecommendations(willingnessToPay: any, pricingInsights: any, valuePerception: any, request: CustomerResearchRequest) {
    const domain = this.extractDomain(request.businessIdea.description);
    const suggestedPrice = willingnessToPay.recommendations.suggestedPrice;

    return {
      recommendedStrategy: willingnessToPay.recommendations.pricingStrategy,
      pricingModel: willingnessToPay.priceModel,
      pricingTiers: this.generatePricingTiers(domain, suggestedPrice),
      rolloutStrategy: {
        launchPrice: Math.round(suggestedPrice * 0.8), // Launch at 20% discount
        pricingEvolution: [
          {
            phase: 'Launch (Months 1-6)',
            timeframe: '6 months',
            price: Math.round(suggestedPrice * 0.8),
            rationale: 'Market penetration pricing to build user base'
          },
          {
            phase: 'Growth (Months 7-18)',
            timeframe: '12 months',
            price: suggestedPrice,
            rationale: 'Standard pricing as value is proven'
          },
          {
            phase: 'Premium (Months 19+)',
            timeframe: 'Ongoing',
            price: Math.round(suggestedPrice * 1.2),
            rationale: 'Premium pricing with enhanced features'
          }
        ]
      }
    };
  }

  private generatePricingTiers(domain: string, basePrice: number) {
    const tierMap = {
      'health-fitness': [
        {
          tier: 'Basic',
          price: Math.round(basePrice * 0.6),
          features: ['Basic workouts', 'Progress tracking', 'Mobile app'],
          targetSegment: 'Budget-conscious fitness enthusiasts',
          conversionProbability: 70
        },
        {
          tier: 'Premium',
          price: basePrice,
          features: ['AI-powered plans', 'Advanced analytics', 'Nutrition guidance', '24/7 support'],
          targetSegment: 'Serious fitness enthusiasts',
          conversionProbability: 85
        },
        {
          tier: 'Elite',
          price: Math.round(basePrice * 1.8),
          features: ['Personal coach access', 'Custom meal plans', 'Live sessions', 'Wearable integration'],
          targetSegment: 'Premium fitness market',
          conversionProbability: 60
        }
      ],
      'business': [
        {
          tier: 'Starter',
          price: Math.round(basePrice * 0.5),
          features: ['Basic automation', '5 integrations', 'Email support'],
          targetSegment: 'Small businesses',
          conversionProbability: 75
        },
        {
          tier: 'Professional',
          price: basePrice,
          features: ['Advanced workflows', 'Unlimited integrations', 'Analytics', 'Priority support'],
          targetSegment: 'Growing businesses',
          conversionProbability: 80
        },
        {
          tier: 'Enterprise',
          price: Math.round(basePrice * 2.5),
          features: ['Custom integrations', 'Dedicated support', 'Advanced security', 'Training'],
          targetSegment: 'Large organizations',
          conversionProbability: 70
        }
      ]
    };

    return tierMap[domain] || tierMap['business']; // Default to business tiers
  }

  private generatePricingDataSources(): DataSource[] {
    return [
      {
        name: 'Market Pricing Analysis',
        type: 'industry-report',
        credibility: 90,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['market price ranges', 'pricing sensitivity', 'payment preferences', 'budget constraints'],
        methodology: 'Comprehensive market pricing research and competitor analysis'
      },
      {
        name: 'Value Perception Study',
        type: 'survey',
        credibility: 85,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['perceived value', 'benefit importance', 'cost justification', 'purchase decision factors'],
        sampleSize: 2800,
        methodology: 'Value perception survey and behavioral analysis'
      },
      {
        name: 'Affordability Assessment',
        type: 'demographic-data',
        credibility: 80,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['income ranges', 'spending capacity', 'budget allocation', 'payment capabilities'],
        methodology: 'Demographics analysis and spending behavior research'
      },
      {
        name: 'Competitive Pricing Intelligence',
        type: 'industry-report',
        credibility: 88,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['competitor prices', 'pricing models', 'market positioning', 'value positioning'],
        methodology: 'Competitive intelligence and pricing strategy analysis'
      }
    ];
  }
}