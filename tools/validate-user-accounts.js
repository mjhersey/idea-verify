#!/usr/bin/env node

/**
 * User Account Setup Validation Script
 * Verifies that users have completed external service account setup
 */

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const validationChecklist = [
    {
        id: 'openai_account',
        question: 'Have you created an OpenAI account with API access enabled? (y/n): ',
        requirement: 'OpenAI account with API access'
    },
    {
        id: 'anthropic_account', 
        question: 'Have you created an Anthropic account with Claude API access? (y/n): ',
        requirement: 'Anthropic account with Claude API access'
    },
    {
        id: 'aws_account',
        question: 'Have you set up AWS account with development IAM user? (y/n): ',
        requirement: 'AWS account with development IAM user'
    },
    {
        id: 'aws_billing',
        question: 'Have you configured billing alerts on your AWS account? (y/n): ',
        requirement: 'AWS billing alerts configured'
    },
    {
        id: 'documentation',
        question: 'Have you documented account details in a secure location? (y/n): ',
        requirement: 'Account documentation completed'
    }
];

async function askQuestion(question) {
    return new Promise(resolve => {
        rl.question(question, answer => {
            resolve(answer.toLowerCase().trim());
        });
    });
}

async function validateUserAccounts() {
    console.log('🔍 User Account Setup Validation\n');
    console.log('This script validates that all required external service accounts are set up.');
    console.log('Please answer honestly - this helps ensure development can proceed smoothly.\n');

    const results = {};
    let allValid = true;

    for (const check of validationChecklist) {
        const answer = await askQuestion(check.question);
        const isValid = answer === 'y' || answer === 'yes';
        
        results[check.id] = {
            requirement: check.requirement,
            completed: isValid
        };

        if (!isValid) {
            allValid = false;
            console.log(`❌ ${check.requirement} - NOT COMPLETED`);
        } else {
            console.log(`✅ ${check.requirement} - COMPLETED`);
        }
    }

    console.log('\n' + '='.repeat(50));
    
    if (allValid) {
        console.log('🎉 All account setup requirements completed!');
        console.log('Development can proceed to credential management setup.');
        process.exit(0);
    } else {
        console.log('⚠️  Some account setup requirements are incomplete.');
        console.log('\nPlease complete the missing requirements before proceeding:');
        
        for (const [id, result] of Object.entries(results)) {
            if (!result.completed) {
                console.log(`- ${result.requirement}`);
            }
        }
        
        console.log('\nRefer to docs/user-responsibility-matrix.md for detailed setup instructions.');
        process.exit(1);
    }
}

// Handle cleanup
process.on('SIGINT', () => {
    console.log('\n\nValidation cancelled by user.');
    rl.close();
    process.exit(130);
});

// Run validation
validateUserAccounts().catch(error => {
    console.error('Error during validation:', error);
    rl.close();
    process.exit(1);
}).finally(() => {
    rl.close();
});