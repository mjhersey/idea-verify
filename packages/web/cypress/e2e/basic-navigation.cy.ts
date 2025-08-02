describe('Basic Navigation', () => {
  it('should navigate between pages', () => {
    cy.visit('/')
    
    // Check home page
    cy.contains('AI Business Validation Platform')
    cy.contains('Validate your business ideas')
    
    // Navigate to evaluation page
    cy.contains('Start Business Evaluation').click()
    cy.url().should('include', '/evaluation')
    cy.contains('Business Idea Evaluation')
    
    // Navigate to dashboard
    cy.visit('/dashboard')
    cy.contains('Dashboard')
    cy.contains('Total Evaluations')
  })
})