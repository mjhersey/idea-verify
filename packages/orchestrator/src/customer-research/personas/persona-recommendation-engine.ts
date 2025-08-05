/**
 * Persona Recommendation Engine
 * Generates detailed customer personas and targeting recommendations
 */

import { CustomerPersona, DataSource, CustomerResearchRequest } from '../schemas/customer-research-types.js';

export interface PersonaRecommendationResult {
  personas: CustomerPersona[];
  personaMetrics: {
    totalPersonas: number;
    primaryPersona: string;
    secondaryPersonas: string[];
    coverageScore: number; // 0-100 - how well personas cover target market
    differentiationScore: number; // 0-100 - how distinct personas are
  };
  targetingStrategy: {
    prioritizedPersonas: Array<{
      persona: string;
      priority: number; // 1-5
      acquisitionDifficulty: 'low' | 'medium' | 'high';
      lifetimeValue: number; // estimated LTV
      timeToValue: string; // time to realize value
      marketingChannels: string[];
      messagingThemes: string[];
    }>;
    segmentationRecommendations: string[];
    customizationOpportunities: string[];
  };
  personaValidation: {
    researchGaps: string[];
    validationMethods: string[];
    assumptionRisks: Array<{
      persona: string;
      assumption: string;
      risk: 'low' | 'medium' | 'high';
      validationApproach: string;
    }>;
  };
  dataSources: DataSource[];
}

export class PersonaRecommendationEngine {
  private readonly analysisTimeout = 2500;

  async generatePersonaRecommendations(request: CustomerResearchRequest): Promise<PersonaRecommendationResult> {
    const startTime = Date.now();
    console.log(`[PersonaRecommendationEngine] Generating persona recommendations for: ${request.businessIdea.title}`);

    try {
      // Parallel analysis of persona generation approaches
      const [
        demographicPersonas,
        behavioralPersonas,
        needsBasedPersonas,
        marketSegmentPersonas
      ] = await Promise.all([
        this.generateDemographicPersonas(request),
        this.generateBehavioralPersonas(request),
        this.generateNeedsBasedPersonas(request),
        this.generateMarketSegmentPersonas(request)
      ]);

      // Synthesize and prioritize personas
      const synthesizedPersonas = this.synthesizePersonas(
        demographicPersonas, behavioralPersonas, needsBasedPersonas, marketSegmentPersonas, request
      );

      // Limit to requested number or default
      const maxPersonas = request.maxPersonas || 4;
      const personas = this.prioritizeAndLimitPersonas(synthesizedPersonas, maxPersonas, request);

      // Calculate persona metrics
      const personaMetrics = this.calculatePersonaMetrics(personas, request);

      // Generate targeting strategy
      const targetingStrategy = this.generateTargetingStrategy(personas, request);

      // Identify validation needs
      const personaValidation = this.generatePersonaValidation(personas, request);

      const dataSources = this.generatePersonaDataSources();

      console.log(`[PersonaRecommendationEngine] Persona generation completed in ${Date.now() - startTime}ms`);

      return {
        personas,
        personaMetrics,
        targetingStrategy,
        personaValidation,
        dataSources
      };

    } catch (error) {
      console.error('[PersonaRecommendationEngine] Persona generation failed:', error);
      throw new Error(`Persona generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateDemographicPersonas(request: CustomerResearchRequest): Promise<CustomerPersona[]> {
    const domain = this.extractDomain(request.businessIdea.description);
    const targetMarket = request.businessIdea.targetMarket?.toLowerCase() || '';
    
    return this.createDemographicPersonas(domain, targetMarket, request);
  }

  private async generateBehavioralPersonas(request: CustomerResearchRequest): Promise<CustomerPersona[]> {
    const domain = this.extractDomain(request.businessIdea.description);
    
    return this.createBehavioralPersonas(domain, request);
  }

  private async generateNeedsBasedPersonas(request: CustomerResearchRequest): Promise<CustomerPersona[]> {
    const domain = this.extractDomain(request.businessIdea.description);
    
    return this.createNeedsBasedPersonas(domain, request);
  }

  private async generateMarketSegmentPersonas(request: CustomerResearchRequest): Promise<CustomerPersona[]> {
    const domain = this.extractDomain(request.businessIdea.description);
    const category = request.businessIdea.category?.toLowerCase() || '';
    
    return this.createMarketSegmentPersonas(domain, category, request);
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

  private createDemographicPersonas(domain: string, targetMarket: string, request: CustomerResearchRequest): CustomerPersona[] {
    const personas: CustomerPersona[] = [];
    
    if (domain === 'health-fitness') {
      personas.push({
        name: 'Sarah Chen',
        title: 'Busy Professional Seeking Fitness Balance',
        demographics: {
          age: 32,
          gender: 'Female',
          income: 75000,
          education: 'Bachelor\'s Degree',
          location: 'Urban - Seattle, WA',
          occupation: 'Marketing Manager'
        },
        background: 'Working professional with demanding schedule who values health but struggles to maintain consistent fitness routine. Lives in urban area with access to gyms but prefers convenient, flexible solutions.',
        goals: [
          'Maintain consistent fitness routine without gym commute',
          'Lose 15 pounds and improve overall health',
          'Find workouts that fit into busy schedule',
          'Track progress and stay motivated'
        ],
        frustrations: [
          'Gym crowded during convenient hours',
          'Generic workout plans don\'t fit her schedule',
          'Loses motivation without accountability',
          'Time wasted on ineffective exercises'
        ],
        motivations: [
          'Career advancement requires energy and confidence',
          'Want to set good example for younger colleagues',
          'Health consciousness from family history',
          'Stress relief from demanding job'
        ],
        behaviors: {
          technology: ['Uses smartphone apps daily', 'Prefers integrated solutions', 'Values data and analytics'],
          communication: ['Email', 'Text messages', 'Professional social media'],
          purchasing: ['Researches before buying', 'Values reviews and recommendations', 'Willing to pay for quality'],
          research: ['Reads health blogs', 'Follows fitness influencers', 'Compares options thoroughly']
        },
        needsAndPainPoints: {
          primaryNeeds: ['Time-efficient workouts', 'Personalized guidance', 'Progress tracking', 'Flexible scheduling'],
          painPoints: ['Limited time', 'Inconsistent results', 'Lack of personalization', 'Motivation challenges'],
          currentSolutions: ['Gym membership (underused)', 'Free YouTube videos', 'Fitness apps (abandoned)'],
          unmetNeeds: ['AI-powered personalization', 'Real-time form correction', 'Integrated lifestyle tracking']
        },
        buyingProcess: {
          trigger: 'Frustration with current fitness routine or health scare',
          evaluationCriteria: ['Time efficiency', 'Personalization level', 'User reviews', 'Free trial availability'],
          decisionFactors: ['Proven results', 'Convenience', 'Cost vs gym membership', 'App quality'],
          influencers: ['Fitness influencers', 'Friends\' recommendations', 'Online reviews'],
          timeline: '2-4 weeks research and evaluation'
        },
        marketingInsights: {
          preferredChannels: ['Instagram', 'LinkedIn', 'Google Search', 'Fitness blogs'],
          messaging: ['Save time, get results', 'Personalized for your lifestyle', 'Proven by professionals'],
          contentTypes: ['Success stories', 'Quick workout demos', 'Health tips', 'Time-saving hacks'],
          engagementStyle: 'Professional but friendly, data-driven, solution-focused'
        },
        priority: 90,
        marketSize: 2800000,
        confidence: 85
      });

      personas.push({
        name: 'Mike Rodriguez',
        title: 'Fitness Enthusiast Seeking Advanced Training',
        demographics: {
          age: 28,
          gender: 'Male',
          income: 65000,
          education: 'College Graduate',
          location: 'Suburban - Austin, TX',
          occupation: 'Software Developer'
        },
        background: 'Tech-savvy fitness enthusiast who has been working out for several years. Knowledgeable about fitness but looking for advanced, personalized training that adapts to his progress.',
        goals: [
          'Break through fitness plateaus',
          'Optimize training with data and technology',
          'Achieve specific strength and physique goals',
          'Efficient workouts that maximize results'
        ],
        frustrations: [
          'Generic programs don\'t challenge him appropriately',
          'Difficulty knowing when to progress or modify routines',
          'Limited access to expert coaching',
          'Inconsistent progress tracking across platforms'
        ],
        motivations: [
          'Personal achievement and self-improvement',
          'Interest in fitness technology and optimization',
          'Competitive nature drives continuous improvement',
          'Health and longevity focus'
        ],
        behaviors: {
          technology: ['Early adopter', 'Uses multiple fitness apps', 'Tracks everything', 'Values integration'],
          communication: ['Social media active', 'Fitness forums', 'Text and messaging apps'],
          purchasing: ['Researches extensively', 'Reads reviews and comparisons', 'Values features over price'],
          research: ['Fitness forums', 'YouTube channels', 'Scientific studies', 'Product comparisons']
        },
        needsAndPainPoints: {
          primaryNeeds: ['Advanced personalization', 'Progress optimization', 'Expert guidance', 'Data integration'],
          painPoints: ['Plateauing results', 'Information overload', 'Lack of expert access', 'Fragmented tracking'],
          currentSolutions: ['Multiple fitness apps', 'Online programs', 'Gym membership'],
          unmetNeeds: ['AI coaching adaptation', 'Comprehensive progress analytics', 'Expert consultation access']
        },
        buyingProcess: {
          trigger: 'Fitness plateau or discovery of new training technology',
          evaluationCriteria: ['Advanced features', 'Personalization depth', 'Data analytics', 'Expert backing'],
          decisionFactors: ['Technical sophistication', 'Proven methodology', 'Integration capabilities'],
          influencers: ['Fitness YouTubers', 'Scientific research', 'User communities'],
          timeline: '3-6 weeks evaluation with trial periods'
        },
        marketingInsights: {
          preferredChannels: ['YouTube', 'Reddit', 'Twitter', 'Fitness forums'],
          messaging: ['Optimize your potential', 'Science-backed training', 'Break through plateaus'],
          contentTypes: ['Technical explanations', 'Progress case studies', 'Feature deep-dives'],
          engagementStyle: 'Technical, data-driven, community-oriented'
        },
        priority: 75,
        marketSize: 1200000,
        confidence: 80
      });
    } else if (domain === 'business') {
      personas.push({
        name: 'Jennifer Walsh',
        title: 'Small Business Owner Seeking Efficiency',
        demographics: {
          age: 42,
          gender: 'Female',
          income: 95000,
          education: 'MBA',
          location: 'Suburban - Denver, CO',
          occupation: 'Small Business Owner (Marketing Agency)'
        },
        background: 'Successful small business owner running a 12-person marketing agency. Constantly looking for ways to streamline operations, reduce manual work, and scale efficiently without proportional cost increases.',
        goals: [
          'Automate repetitive business processes',
          'Improve team productivity and collaboration',
          'Scale business without hiring proportionally',
          'Better client relationship management'
        ],
        frustrations: [
          'Too much manual data entry and administrative work',
          'Disconnected systems create information silos',
          'Difficult to get real-time business insights',
          'Time spent on operations instead of strategy'
        ],
        motivations: [
          'Business growth and profitability',
          'Work-life balance for herself and team',
          'Competitive advantage through efficiency',
          'Professional satisfaction from smooth operations'
        ],
        behaviors: {
          technology: ['Adopts proven solutions', 'Values integration', 'Needs reliability', 'Prefers comprehensive platforms'],
          communication: ['Email heavy user', 'Video calls', 'Project management tools', 'Professional networks'],
          purchasing: ['ROI-focused decisions', 'Involves team in evaluation', 'Prefers annual contracts', 'Values support'],
          research: ['Industry publications', 'Peer recommendations', 'Professional associations', 'Case studies']
        },
        needsAndPainPoints: {
          primaryNeeds: ['Process automation', 'System integration', 'Real-time insights', 'Scalable solutions'],
          painPoints: ['Manual processes', 'Data silos', 'Limited visibility', 'Time management'],
          currentSolutions: ['Multiple point solutions', 'Manual processes', 'Basic CRM', 'Spreadsheets'],
          unmetNeeds: ['End-to-end automation', 'Predictive analytics', 'Intelligent workflow optimization']
        },
        buyingProcess: {
          trigger: 'Business growth pain points or competitive pressure',
          evaluationCriteria: ['ROI potential', 'Integration capabilities', 'Implementation complexity', 'Support quality'],
          decisionFactors: ['Proven results', 'Total cost of ownership', 'Team adoption ease', 'Vendor reliability'],
          influencers: ['Industry peers', 'Professional associations', 'Consultants', 'Team feedback'],
          timeline: '6-12 weeks evaluation with stakeholder input'
        },
        marketingInsights: {
          preferredChannels: ['LinkedIn', 'Industry publications', 'Professional associations', 'Email marketing'],
          messaging: ['Scale your business efficiently', 'ROI-driven solutions', 'Proven by businesses like yours'],
          contentTypes: ['Case studies', 'ROI calculators', 'Implementation guides', 'Best practices'],
          engagementStyle: 'Professional, results-focused, evidence-based'
        },
        priority: 95,
        marketSize: 1800000,
        confidence: 88
      });
    } else if (domain === 'technology') {
      personas.push({
        name: 'Alex Kumar',
        title: 'Senior Developer Seeking Productivity Tools',
        demographics: {
          age: 29,
          gender: 'Male',
          income: 125000,
          education: 'Computer Science Degree',
          location: 'Urban - San Francisco, CA',
          occupation: 'Senior Software Engineer'
        },
        background: 'Experienced software developer at a mid-size tech company. Values tools that improve development speed, code quality, and team collaboration. Influences tool adoption decisions within his team.',
        goals: [
          'Improve development productivity and code quality',
          'Reduce debugging time and technical debt',
          'Better team collaboration and knowledge sharing',
          'Stay current with development best practices'
        ],
        frustrations: [
          'Time-consuming setup and configuration of dev tools',
          'Fragmented toolchain with poor integration',
          'Difficulty identifying performance bottlenecks',
          'Inconsistent development environments across team'
        ],
        motivations: [
          'Professional growth and skill advancement',
          'Pride in code quality and system performance',
          'Efficiency and productivity optimization',
          'Contributing to team and company success'
        ],
        behaviors: {
          technology: ['Early adopter', 'Open source advocate', 'Values automation', 'Prefers command-line tools'],
          communication: ['Slack/Discord', 'GitHub discussions', 'Stack Overflow', 'Tech Twitter'],
          purchasing: ['Evaluates free tiers first', 'Values technical documentation', 'Peer recommendations important'],
          research: ['GitHub repositories', 'Technical blogs', 'Developer communities', 'Conference talks']
        },
        needsAndPainPoints: {
          primaryNeeds: ['Development speed', 'Code quality tools', 'Performance insights', 'Team collaboration'],
          painPoints: ['Tool complexity', 'Configuration overhead', 'Performance mysteries', 'Context switching'],
          currentSolutions: ['IDE plugins', 'Multiple monitoring tools', 'Manual code reviews', 'Basic analytics'],
          unmetNeeds: ['Intelligent code analysis', 'Predictive performance insights', 'Seamless workflow integration']
        },
        buyingProcess: {
          trigger: 'Performance issues, new project requirements, or team growth',
          evaluationCriteria: ['Technical capabilities', 'Integration ease', 'Documentation quality', 'Community support'],
          decisionFactors: ['Developer experience', 'Technical merit', 'Pricing model', 'Company backing'],
          influencers: ['Tech leads', 'Developer community', 'Documentation', 'Trial experience'],
          timeline: '2-4 weeks evaluation with proof-of-concept'
        },
        marketingInsights: {
          preferredChannels: ['GitHub', 'Developer blogs', 'Tech conferences', 'Reddit', 'Twitter'],
          messaging: ['Built by developers, for developers', 'Boost your development workflow', 'Focus on code, not tooling'],
          contentTypes: ['Technical tutorials', 'Open source examples', 'Performance benchmarks', 'Integration guides'],
          engagementStyle: 'Technical, honest, community-focused'
        },
        priority: 85,
        marketSize: 950000,
        confidence: 82
      });
    }

    return personas;
  }

  private createBehavioralPersonas(domain: string, request: CustomerResearchRequest): CustomerPersona[] {
    // Create personas based on behavioral patterns
    if (domain === 'health-fitness') {
      return [{
        name: 'Maria Santos',
        title: 'Motivation-Driven Fitness Seeker',
        demographics: {
          age: 35,
          gender: 'Female',
          income: 58000,
          education: 'Some College',
          location: 'Suburban - Phoenix, AZ',
          occupation: 'Administrative Assistant'
        },
        background: 'Has tried multiple fitness solutions but struggles with consistency. Highly motivated in short bursts but needs external accountability and community support to maintain long-term habits.',
        goals: [
          'Build sustainable fitness habits',
          'Find accountability and motivation',
          'Achieve gradual, lasting health improvements',
          'Connect with supportive fitness community'
        ],
        frustrations: [
          'Starts strong but loses motivation quickly',
          'Feels intimidated by advanced fitness programs',
          'Lacks accountability when working out alone',
          'Difficulty seeing progress and staying encouraged'
        ],
        motivations: [
          'Health improvement for family responsibilities',
          'Building confidence and self-esteem',
          'Social connection and community belonging',
          'Setting positive example for children'
        ],
        behaviors: {
          technology: ['Mobile-first user', 'Values simplicity', 'Uses social features', 'Prefers guided experiences'],
          communication: ['Facebook', 'Text messaging', 'WhatsApp', 'Community groups'],
          purchasing: ['Price-conscious', 'Values community feedback', 'Prefers monthly payments', 'Needs strong support'],
          research: ['Facebook groups', 'Friend recommendations', 'Simple online reviews', 'Community testimonials']
        },
        needsAndPainPoints: {
          primaryNeeds: ['Motivation and accountability', 'Beginner-friendly approach', 'Community support', 'Progress celebration'],
          painPoints: ['Motivation drops', 'Information overwhelm', 'Feeling judged', 'Inconsistent progress'],
          currentSolutions: ['Free workout videos', 'Walking groups', 'Occasional gym visits'],
          unmetNeeds: ['Personalized motivation system', 'Supportive community', 'Gradual progression tracking']
        },
        buyingProcess: {
          trigger: 'Health concern, life event, or renewed motivation',
          evaluationCriteria: ['Beginner-friendliness', 'Community support', 'Success stories', 'Affordability'],
          decisionFactors: ['Testimonials', 'Free trial availability', 'Support quality', 'Community feeling'],
          influencers: ['Friends and family', 'Success stories', 'Community members'],
          timeline: '1-2 weeks with emphasis on trial experience'
        },
        marketingInsights: {
          preferredChannels: ['Facebook', 'Instagram', 'Community centers', 'Word of mouth'],
          messaging: ['You\'re not alone in this journey', 'Small steps, big results', 'Supportive community'],
          contentTypes: ['Success stories', 'Community highlights', 'Beginner tips', 'Motivational content'],
          engagementStyle: 'Encouraging, non-intimidating, community-focused'
        },
        priority: 70,
        marketSize: 3200000,
        confidence: 75
      }];
    }
    return [];
  }

  private createNeedsBasedPersonas(domain: string, request: CustomerResearchRequest): CustomerPersona[] {
    // Create personas based on specific needs and use cases
    if (domain === 'business') {
      return [{
        name: 'David Chen',
        title: 'Growth-Stage Startup Founder',
        demographics: {
          age: 34,
          gender: 'Male',
          income: 85000,
          education: 'Master\'s Degree',
          location: 'Urban - Austin, TX',
          occupation: 'Startup Founder/CEO'
        },
        background: 'Founded a B2B SaaS company 2 years ago, now at 15 employees and growing rapidly. Needs scalable systems and processes to manage growth without losing agility or breaking the bank.',
        goals: [
          'Scale operations efficiently as company grows',
          'Maintain startup agility while adding structure',
          'Optimize cash flow and operational efficiency',
          'Build systems that support team growth'
        ],
        frustrations: [
          'Outgrowing current tools and processes',
          'Limited budget for enterprise solutions',
          'Time spent on operations instead of strategy',
          'Difficulty finding tools that scale with growth'
        ],
        motivations: [
          'Company success and growth trajectory',
          'Team efficiency and satisfaction',
          'Investor confidence and metrics',
          'Personal success as a founder'
        ],
        behaviors: {
          technology: ['Values proven solutions', 'Needs quick implementation', 'Prefers integrated platforms', 'Budget-conscious'],
          communication: ['Slack', 'Email', 'Video calls', 'Project management tools'],
          purchasing: ['Fast decision maker', 'Values scalability', 'Prefers flexible pricing', 'Needs quick ROI'],
          research: ['Startup communities', 'Founder networks', 'Product Hunt', 'Peer recommendations']
        },
        needsAndPainPoints: {
          primaryNeeds: ['Scalable solutions', 'Quick implementation', 'Cost-effective tools', 'Growth-ready systems'],
          painPoints: ['Outgrowing tools quickly', 'Budget constraints', 'Implementation time', 'Integration complexity'],
          currentSolutions: ['Basic SaaS tools', 'Manual processes', 'Spreadsheets', 'Free tier solutions'],
          unmetNeeds: ['Growth-adaptive pricing', 'Rapid deployment solutions', 'Startup-focused features']
        },
        buyingProcess: {
          trigger: 'Growth milestones, operational pain points, or funding rounds',
          evaluationCriteria: ['Scalability', 'Implementation speed', 'Pricing model', 'Support quality'],
          decisionFactors: ['Growth potential', 'Team adoption ease', 'Cost vs value', 'Integration capabilities'],
          influencers: ['Co-founders', 'Advisors', 'Peer founders', 'Team feedback'],
          timeline: '2-4 weeks with urgency driven by growth needs'
        },
        marketingInsights: {
          preferredChannels: ['Product Hunt', 'Startup communities', 'LinkedIn', 'Founder networks'],
          messaging: ['Built for growth', 'Scales with your startup', 'Founder-friendly pricing'],
          contentTypes: ['Growth case studies', 'Founder testimonials', 'Scaling guides', 'ROI calculators'],
          engagementStyle: 'Founder-to-founder, growth-focused, pragmatic'
        },
        priority: 88,
        marketSize: 450000,
        confidence: 80
      }];
    }
    return [];
  }

  private createMarketSegmentPersonas(domain: string, category: string, request: CustomerResearchRequest): CustomerPersona[] {
    // Create personas based on market segments and categories
    const personas: CustomerPersona[] = [];

    if (category.includes('b2b') || category.includes('business')) {
      personas.push({
        name: 'Robert Kim',
        title: 'Enterprise IT Decision Maker',
        demographics: {
          age: 45,
          gender: 'Male',
          income: 145000,
          education: 'Master\'s Degree',
          location: 'Urban - Chicago, IL',
          occupation: 'IT Director'
        },
        background: 'Senior IT professional responsible for technology decisions at a 500-person manufacturing company. Focuses on solutions that improve operational efficiency while maintaining security and compliance.',
        goals: [
          'Improve operational efficiency through technology',
          'Maintain security and compliance standards',
          'Reduce total cost of ownership',
          'Support business growth with scalable solutions'
        ],
        frustrations: [
          'Lengthy procurement and approval processes',
          'Integration challenges with legacy systems',
          'Budget constraints despite clear ROI',
          'Balancing innovation with risk management'
        ],
        motivations: [
          'Business impact and efficiency gains',
          'Professional reputation and success',
          'Team productivity and satisfaction',
          'Staying current with technology trends'
        ],
        behaviors: {
          technology: ['Cautious adopter', 'Values proven solutions', 'Needs comprehensive evaluation', 'Security-focused'],
          communication: ['Email', 'Professional meetings', 'Industry conferences', 'Vendor presentations'],
          purchasing: ['Committee-based decisions', 'Extensive evaluation', 'Prefers established vendors', 'Values support'],
          research: ['Industry reports', 'Peer networks', 'Vendor briefings', 'Professional associations']
        },
        needsAndPainPoints: {
          primaryNeeds: ['Enterprise-grade security', 'Scalable architecture', 'Integration capabilities', 'Vendor support'],
          painPoints: ['Procurement complexity', 'Integration challenges', 'Change management', 'Budget justification'],
          currentSolutions: ['Enterprise software suites', 'Legacy systems', 'Manual processes'],
          unmetNeeds: ['Seamless legacy integration', 'Rapid deployment options', 'Risk-free evaluation']
        },
        buyingProcess: {
          trigger: 'Business requirements, compliance needs, or technology refresh cycles',
          evaluationCriteria: ['Security standards', 'Scalability', 'Vendor stability', 'Total cost of ownership'],
          decisionFactors: ['Risk mitigation', 'Business case strength', 'Implementation complexity', 'Support quality'],
          influencers: ['C-level executives', 'IT team', 'Business users', 'External consultants'],
          timeline: '6-18 months depending on complexity and budget cycles'
        },
        marketingInsights: {
          preferredChannels: ['Industry publications', 'Professional conferences', 'LinkedIn', 'Direct sales'],
          messaging: ['Enterprise-proven solutions', 'Security and compliance first', 'Measurable business impact'],
          contentTypes: ['White papers', 'Case studies', 'Security briefings', 'ROI analyses'],
          engagementStyle: 'Professional, detailed, risk-aware'
        },
        priority: 85,
        marketSize: 280000,
        confidence: 82
      });
    }

    return personas;
  }

  private synthesizePersonas(
    demographicPersonas: CustomerPersona[],
    behavioralPersonas: CustomerPersona[],
    needsBasedPersonas: CustomerPersona[],
    marketSegmentPersonas: CustomerPersona[],
    request: CustomerResearchRequest
  ): CustomerPersona[] {
    // Combine all personas and remove duplicates
    const allPersonas = [
      ...demographicPersonas,
      ...behavioralPersonas,
      ...needsBasedPersonas,
      ...marketSegmentPersonas
    ];

    // Remove duplicates based on similar characteristics
    const uniquePersonas = this.deduplicatePersonas(allPersonas);

    // Add market sizing and confidence scores
    return uniquePersonas.map(persona => ({
      ...persona,
      marketSize: this.calculatePersonaMarketSize(persona, request),
      confidence: this.calculatePersonaConfidence(persona, request)
    }));
  }

  private deduplicatePersonas(personas: CustomerPersona[]): CustomerPersona[] {
    const uniquePersonas: CustomerPersona[] = [];
    const seenNames = new Set<string>();

    for (const persona of personas) {
      if (!seenNames.has(persona.name)) {
        seenNames.add(persona.name);
        uniquePersonas.push(persona);
      }
    }

    return uniquePersonas;
  }

  private calculatePersonaMarketSize(persona: CustomerPersona, request: CustomerResearchRequest): number {
    // Use existing market size or calculate based on demographics and target market
    if (persona.marketSize && persona.marketSize > 0) {
      return persona.marketSize;
    }

    const domain = this.extractDomain(request.businessIdea.description);
    const baseSize = this.getBaseDomainMarketSize(domain);
    
    // Adjust based on persona specificity
    let sizingFactor = 0.15; // Default 15% of domain market
    
    if (persona.demographics.income > 100000) {
      sizingFactor *= 0.6; // Smaller but higher-value segment
    }
    
    if (persona.title.includes('Enterprise') || persona.title.includes('Director')) {
      sizingFactor *= 0.3; // Much smaller enterprise segment
    }

    return Math.round(baseSize * sizingFactor);
  }

  private getBaseDomainMarketSize(domain: string): number {
    const marketSizes = {
      'health-fitness': 15000000,
      'business': 8000000,
      'technology': 5000000,
      'finance': 12000000,
      'education': 7000000,
      'general': 10000000
    };
    return marketSizes[domain] || 10000000;
  }

  private calculatePersonaConfidence(persona: CustomerPersona, request: CustomerResearchRequest): number {
    // Use existing confidence or calculate based on persona completeness
    if (persona.confidence && persona.confidence > 0) {
      return persona.confidence;
    }

    let confidence = 70; // Base confidence

    // Adjust based on persona detail completeness
    if (persona.background && persona.background.length > 50) confidence += 5;
    if (persona.goals.length >= 4) confidence += 5;
    if (persona.frustrations.length >= 4) confidence += 5;
    if (persona.behaviors.technology.length >= 3) confidence += 5;
    if (persona.buyingProcess.timeline) confidence += 5;

    // Adjust based on analysis depth
    if (request.analysisDepth === 'comprehensive') {
      confidence += 5;
    } else if (request.analysisDepth === 'basic') {
      confidence -= 5;
    }

    return Math.min(100, Math.max(60, confidence));
  }

  private prioritizeAndLimitPersonas(personas: CustomerPersona[], maxPersonas: number, request: CustomerResearchRequest): CustomerPersona[] {
    // Sort personas by priority and market size
    const sortedPersonas = personas.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.marketSize - a.marketSize;
    });

    return sortedPersonas.slice(0, maxPersonas);
  }

  private calculatePersonaMetrics(personas: CustomerPersona[], request: CustomerResearchRequest) {
    const totalPersonas = personas.length;
    const primaryPersona = personas.length > 0 ? personas[0].name : 'None identified';
    const secondaryPersonas = personas.slice(1, 3).map(p => p.name);

    // Calculate coverage score (how well personas cover the target market)
    const totalMarketSize = personas.reduce((sum, p) => sum + p.marketSize, 0);
    const domainMarketSize = this.getBaseDomainMarketSize(this.extractDomain(request.businessIdea.description));
    const coverageScore = Math.min(100, Math.round((totalMarketSize / domainMarketSize) * 100));

    // Calculate differentiation score (how distinct personas are)
    const differentiationScore = this.calculateDifferentiationScore(personas);

    return {
      totalPersonas,
      primaryPersona,
      secondaryPersonas,
      coverageScore,
      differentiationScore
    };
  }

  private calculateDifferentiationScore(personas: CustomerPersona[]): number {
    if (personas.length <= 1) return 100;

    let totalDifference = 0;
    let comparisons = 0;

    for (let i = 0; i < personas.length; i++) {
      for (let j = i + 1; j < personas.length; j++) {
        const difference = this.calculatePersonaDifference(personas[i], personas[j]);
        totalDifference += difference;
        comparisons++;
      }
    }

    return Math.round(totalDifference / comparisons);
  }

  private calculatePersonaDifference(persona1: CustomerPersona, persona2: CustomerPersona): number {
    let differences = 0;
    let factors = 0;

    // Age difference
    const ageDiff = Math.abs(persona1.demographics.age - persona2.demographics.age);
    differences += Math.min(100, ageDiff * 2); // Max 100 for 50+ year difference
    factors++;

    // Income difference
    const incomeDiff = Math.abs(persona1.demographics.income - persona2.demographics.income);
    differences += Math.min(100, (incomeDiff / 1000) * 2); // Normalize income difference
    factors++;

    // Occupation difference (simple check)
    if (persona1.demographics.occupation !== persona2.demographics.occupation) {
      differences += 50;
    }
    factors++;

    // Priority difference
    const priorityDiff = Math.abs(persona1.priority - persona2.priority);
    differences += priorityDiff * 2;
    factors++;

    return Math.round(differences / factors);
  }

  private generateTargetingStrategy(personas: CustomerPersona[], request: CustomerResearchRequest) {
    const prioritizedPersonas = personas.map((persona, index) => ({
      persona: persona.name,
      priority: index + 1,
      acquisitionDifficulty: this.assessAcquisitionDifficulty(persona),
      lifetimeValue: this.estimateLifetimeValue(persona, request),
      timeToValue: this.estimateTimeToValue(persona, request),
      marketingChannels: persona.marketingInsights.preferredChannels,
      messagingThemes: persona.marketingInsights.messaging
    }));

    const segmentationRecommendations = this.generateSegmentationRecommendations(personas, request);
    const customizationOpportunities = this.identifyCustomizationOpportunities(personas, request);

    return {
      prioritizedPersonas,
      segmentationRecommendations,
      customizationOpportunities
    };
  }

  private assessAcquisitionDifficulty(persona: CustomerPersona): 'low' | 'medium' | 'high' {
    const timeline = persona.buyingProcess.timeline;
    const decisionComplexity = persona.buyingProcess.influencers.length;

    if (timeline.includes('weeks') && timeline.includes('1-2')) {
      return 'low';
    } else if (timeline.includes('months') && decisionComplexity > 3) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  private estimateLifetimeValue(persona: CustomerPersona, request: CustomerResearchRequest): number {
    const domain = this.extractDomain(request.businessIdea.description);
    const baseValues = {
      'health-fitness': 500,
      'business': 5000,
      'technology': 2000,
      'finance': 1500,
      'education': 800,
      'general': 1000
    };

    let baseValue = baseValues[domain] || 1000;

    // Adjust based on persona income
    if (persona.demographics.income > 100000) {
      baseValue *= 2;
    } else if (persona.demographics.income > 75000) {
      baseValue *= 1.5;
    }

    // Adjust based on business vs consumer
    if (persona.demographics.occupation.includes('Owner') || persona.demographics.occupation.includes('Director')) {
      baseValue *= 3;
    }

    return Math.round(baseValue);
  }

  private estimateTimeToValue(persona: CustomerPersona, request: CustomerResearchRequest): string {
    const domain = this.extractDomain(request.businessIdea.description);

    if (domain === 'health-fitness') {
      return '2-4 weeks';
    } else if (domain === 'business') {
      return persona.title.includes('Enterprise') ? '3-6 months' : '1-3 months';
    } else if (domain === 'technology') {
      return '1-4 weeks';
    } else {
      return '2-8 weeks';
    }
  }

  private generateSegmentationRecommendations(personas: CustomerPersona[], request: CustomerResearchRequest): string[] {
    const recommendations = [];

    if (personas.length > 1) {
      recommendations.push('Implement persona-based segmentation for targeted marketing campaigns');
    }

    const hasHighIncomePersonas = personas.some(p => p.demographics.income > 100000);
    const hasLowIncomePersonas = personas.some(p => p.demographics.income < 60000);

    if (hasHighIncomePersonas && hasLowIncomePersonas) {
      recommendations.push('Consider tiered pricing strategy to address different income segments');
    }

    const businessPersonas = personas.filter(p => 
      p.demographics.occupation.includes('Owner') || 
      p.demographics.occupation.includes('Director') ||
      p.demographics.occupation.includes('Manager')
    );

    if (businessPersonas.length > 0) {
      recommendations.push('Develop B2B-specific features and messaging for business decision makers');
    }

    const techSavvyPersonas = personas.filter(p => 
      p.behaviors.technology.includes('Early adopter') ||
      p.behaviors.technology.includes('Uses multiple apps')
    );

    if (techSavvyPersonas.length > 0) {
      recommendations.push('Create advanced features and integrations for tech-savvy users');
    }

    return recommendations.length > 0 ? recommendations : ['Focus on primary persona for initial market entry'];
  }

  private identifyCustomizationOpportunities(personas: CustomerPersona[], request: CustomerResearchRequest): string[] {
    const opportunities = [];

    // Analyze common needs across personas
    const allNeeds = personas.flatMap(p => p.needsAndPainPoints.primaryNeeds);
    const needCounts = allNeeds.reduce((acc, need) => {
      acc[need] = (acc[need] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonNeeds = Object.entries(needCounts)
      .filter(([, count]) => count > 1)
      .map(([need]) => need);

    if (commonNeeds.length > 0) {
      opportunities.push(`Core features should address: ${commonNeeds.slice(0, 3).join(', ')}`);
    }

    // Identify unique needs for customization
    const uniqueNeeds = Object.entries(needCounts)
      .filter(([, count]) => count === 1)
      .map(([need]) => need);

    if (uniqueNeeds.length > 0) {
      opportunities.push(`Customization opportunities: ${uniqueNeeds.slice(0, 3).join(', ')}`);
    }

    // Communication preferences
    const communicationChannels = personas.flatMap(p => p.marketingInsights.preferredChannels);
    const uniqueChannels = Array.from(new Set(communicationChannels));

    if (uniqueChannels.length > 3) {
      opportunities.push('Multi-channel marketing approach needed for diverse persona preferences');
    }

    return opportunities.length > 0 ? opportunities : ['Focus on core functionality that serves all personas'];
  }

  private generatePersonaValidation(personas: CustomerPersona[], request: CustomerResearchRequest) {
    const researchGaps = this.identifyResearchGaps(personas, request);
    const validationMethods = this.recommendValidationMethods(personas, request);
    const assumptionRisks = this.identifyAssumptionRisks(personas, request);

    return {
      researchGaps,
      validationMethods,
      assumptionRisks
    };
  }

  private identifyResearchGaps(personas: CustomerPersona[], request: CustomerResearchRequest): string[] {
    const gaps = [];

    // Check for missing demographic diversity
    const ageRanges = personas.map(p => p.demographics.age);
    const ageSpread = Math.max(...ageRanges) - Math.min(...ageRanges);
    
    if (ageSpread < 15) {
      gaps.push('Limited age diversity in personas - consider broader demographic research');
    }

    // Check for income diversity
    const incomes = personas.map(p => p.demographics.income);
    const incomeSpread = Math.max(...incomes) - Math.min(...incomes);
    
    if (incomeSpread < 30000) {
      gaps.push('Narrow income range coverage - validate affordability across economic segments');
    }

    // Check for behavioral validation
    const behaviorTypes = personas.flatMap(p => p.behaviors.technology);
    const uniqueBehaviors = new Set(behaviorTypes);
    
    if (uniqueBehaviors.size < 5) {
      gaps.push('Limited behavioral pattern diversity - conduct additional behavioral research');
    }

    // Check for buying process validation
    const timelines = personas.map(p => p.buyingProcess.timeline);
    const hasLongTimeline = timelines.some(t => t.includes('months'));
    const hasShortTimeline = timelines.some(t => t.includes('weeks'));
    
    if (!hasLongTimeline || !hasShortTimeline) {
      gaps.push('Missing validation of different decision-making timelines');
    }

    return gaps.length > 0 ? gaps : ['No significant research gaps identified'];
  }

  private recommendValidationMethods(personas: CustomerPersona[], request: CustomerResearchRequest): string[] {
    const methods = [
      'Conduct customer interviews with 5-10 people per persona',
      'Create persona-specific surveys to validate assumptions',
      'Run A/B tests on messaging for different personas',
      'Analyze existing customer data for persona validation'
    ];

    const domain = this.extractDomain(request.businessIdea.description);
    
    if (domain === 'business') {
      methods.push('Conduct stakeholder interviews at target companies');
      methods.push('Validate B2B buying processes through sales conversations');
    } else if (domain === 'health-fitness') {
      methods.push('Run focus groups on fitness motivation and barriers');
      methods.push('Test persona assumptions through fitness community engagement');
    } else if (domain === 'technology') {
      methods.push('Validate personas through developer community engagement');
      methods.push('Test assumptions via technical forums and beta programs');
    }

    return methods;
  }

  private identifyAssumptionRisks(personas: CustomerPersona[], request: CustomerResearchRequest) {
    const risks = [];

    personas.forEach(persona => {
      // High confidence personas may have assumption risks
      if (persona.confidence > 85) {
        risks.push({
          persona: persona.name,
          assumption: 'High confidence in persona accuracy without extensive validation',
          risk: 'medium' as const,
          validationApproach: 'Conduct targeted customer interviews to validate key assumptions'
        });
      }

      // Income-based assumptions
      if (persona.demographics.income > 100000) {
        risks.push({
          persona: persona.name,
          assumption: 'High-income demographic will pay premium pricing',
          risk: 'low' as const,
          validationApproach: 'Test pricing sensitivity through willingness-to-pay surveys'
        });
      }

      // Technology adoption assumptions
      if (persona.behaviors.technology.includes('Early adopter')) {
        risks.push({
          persona: persona.name,
          assumption: 'Early adopters will try new solution without extensive proof',
          risk: 'medium' as const,
          validationApproach: 'Beta testing program with early adopter community'
        });
      }

      // Complex buying process assumptions
      if (persona.buyingProcess.influencers.length > 3) {
        risks.push({
          persona: persona.name,
          assumption: 'Complex decision-making process accurately mapped',
          risk: 'high' as const,
          validationApproach: 'Shadow actual buying processes at target organizations'
        });
      }
    });

    return risks.length > 0 ? risks : [{
      persona: 'All personas',
      assumption: 'Persona accuracy based on limited data',
      risk: 'low' as const,
      validationApproach: 'Continuous validation through customer feedback and analytics'
    }];
  }

  private generatePersonaDataSources(): DataSource[] {
    return [
      {
        name: 'Demographic Persona Analysis',
        type: 'demographic-data',
        credibility: 85,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['age demographics', 'income distributions', 'occupation patterns', 'geographic segmentation'],
        methodology: 'Statistical demographic analysis and market segmentation research'
      },
      {
        name: 'Behavioral Pattern Research',
        type: 'survey',
        credibility: 80,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['technology adoption', 'purchasing behavior', 'communication preferences', 'decision processes'],
        sampleSize: 1500,
        methodology: 'Multi-channel behavioral survey and observational research'
      },
      {
        name: 'Customer Journey Mapping',
        type: 'interview',
        credibility: 88,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['buying processes', 'decision factors', 'pain points', 'motivations'],
        sampleSize: 150,
        methodology: 'In-depth customer interviews and journey mapping sessions'
      },
      {
        name: 'Market Segmentation Analysis',
        type: 'industry-report',
        credibility: 90,
        recency: new Date(),
        accessDate: new Date(),
        dataPoints: ['market segments', 'persona archetypes', 'behavioral clusters', 'targeting strategies'],
        methodology: 'Comprehensive market research and segmentation analysis'
      }
    ];
  }
}