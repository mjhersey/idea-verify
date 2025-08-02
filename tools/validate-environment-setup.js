#!/usr/bin/env node

/**
 * Environment Setup Validation
 * Validates that all packages have proper environment configuration
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function validateEnvironmentVariables() {
  console.log('🔧 Validating Environment Variables...');
  
  const requiredVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'REDIS_URL',
    'FRONTEND_URL',
    'VITE_API_BASE_URL'
  ];
  
  const missing = [];
  const present = [];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }
  
  console.log(`✅ Present (${present.length}): ${present.join(', ')}`);
  
  if (missing.length > 0) {
    console.log(`❌ Missing (${missing.length}): ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

function validatePackageConfigurations() {
  console.log('📦 Validating Package Configurations...');
  
  const packages = [
    {
      name: 'web',
      configFiles: ['vite.config.ts', 'tsconfig.json', 'package.json'],
      envFile: 'env.d.ts'
    },
    {
      name: 'api',
      configFiles: ['tsconfig.json', 'package.json'],
      srcFiles: ['src/app.ts', 'src/server.ts']
    },
    {
      name: 'shared',
      configFiles: ['tsconfig.json', 'package.json', 'vitest.config.ts'],
      srcFiles: ['src/index.ts']
    },
    {
      name: 'orchestrator',
      configFiles: ['package.json'],
      srcFiles: []
    }
  ];
  
  let allValid = true;
  
  for (const pkg of packages) {
    const pkgDir = join(rootDir, 'packages', pkg.name);
    console.log(`\n📋 Checking ${pkg.name} package...`);
    
    // Check if package directory exists
    if (!existsSync(pkgDir)) {
      console.log(`❌ Package directory does not exist: ${pkgDir}`);
      allValid = false;
      continue;
    }
    
    // Check configuration files
    const missingConfigs = [];
    const presentConfigs = [];
    
    for (const configFile of pkg.configFiles) {
      const filePath = join(pkgDir, configFile);
      if (existsSync(filePath)) {
        presentConfigs.push(configFile);
      } else {
        missingConfigs.push(configFile);
      }
    }
    
    // Check source files
    if (pkg.srcFiles) {
      for (const srcFile of pkg.srcFiles) {
        const filePath = join(pkgDir, srcFile);
        if (existsSync(filePath)) {
          presentConfigs.push(srcFile);
        } else {
          missingConfigs.push(srcFile);
        }
      }
    }
    
    // Check environment file for web package
    if (pkg.envFile) {
      const filePath = join(pkgDir, pkg.envFile);
      if (existsSync(filePath)) {
        presentConfigs.push(pkg.envFile);
      } else {
        missingConfigs.push(pkg.envFile);
      }
    }
    
    console.log(`   ✅ Present: ${presentConfigs.join(', ')}`);
    if (missingConfigs.length > 0) {
      console.log(`   ❌ Missing: ${missingConfigs.join(', ')}`);
      allValid = false;
    }
  }
  
  return allValid;
}

function validateSharedIntegration() {
  console.log('\n🔗 Validating Shared Package Integration...');
  
  const integrationChecks = [
    {
      package: 'api',
      file: 'src/app.ts',
      imports: ['@ai-validation/shared']
    },
    {
      package: 'web',
      file: 'src/services/api.ts',
      imports: ['../config/environment']
    }
  ];
  
  let allValid = true;
  
  for (const check of integrationChecks) {
    const filePath = join(rootDir, 'packages', check.package, check.file);
    
    if (!existsSync(filePath)) {
      console.log(`❌ File not found: ${check.file} in ${check.package}`);
      allValid = false;
      continue;
    }
    
    const content = readFileSync(filePath, 'utf-8');
    const missingImports = [];
    const presentImports = [];
    
    for (const importPath of check.imports) {
      if (content.includes(importPath)) {
        presentImports.push(importPath);
      } else {
        missingImports.push(importPath);
      }
    }
    
    console.log(`   📁 ${check.package}/${check.file}:`);
    console.log(`      ✅ Imports: ${presentImports.join(', ')}`);
    
    if (missingImports.length > 0) {
      console.log(`      ❌ Missing: ${missingImports.join(', ')}`);
      allValid = false;
    }
  }
  
  return allValid;
}

function validateCredentialAccess() {
  console.log('\n🔐 Validating Credential Access...');
  
  try {
    // Import shared utilities to test credential access
    const sharedIndexPath = join(rootDir, 'packages/shared/src/index.ts');
    
    if (!existsSync(sharedIndexPath)) {
      console.log('❌ Shared package index not found');
      return false;
    }
    
    const content = readFileSync(sharedIndexPath, 'utf-8');
    const expectedExports = [
      'SecretsManager',
      'RateLimiter',
      'loadEnvironmentConfig'
    ];
    
    const missingExports = [];
    const presentExports = [];
    
    for (const exportName of expectedExports) {
      if (content.includes(exportName)) {
        presentExports.push(exportName);
      } else {
        missingExports.push(exportName);
      }
    }
    
    console.log(`✅ Available exports: ${presentExports.join(', ')}`);
    
    if (missingExports.length > 0) {
      console.log(`❌ Missing exports: ${missingExports.join(', ')}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Error validating credential access: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Environment Setup Validation');
  console.log('=====================================');
  
  const checks = [
    { name: 'Environment Variables', fn: validateEnvironmentVariables },
    { name: 'Package Configurations', fn: validatePackageConfigurations },
    { name: 'Shared Integration', fn: validateSharedIntegration },
    { name: 'Credential Access', fn: validateCredentialAccess }
  ];
  
  const results = [];
  
  for (const check of checks) {
    try {
      const result = await check.fn();
      results.push({ name: check.name, success: result });
    } catch (error) {
      console.log(`❌ ${check.name} failed: ${error.message}`);
      results.push({ name: check.name, success: false });
    }
  }
  
  console.log('\n📊 Validation Summary:');
  console.log('======================');
  
  for (const result of results) {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} - ${result.name}`);
  }
  
  const allPassed = results.every(r => r.success);
  
  if (allPassed) {
    console.log('\n🎉 All environment validations passed!');
    console.log('The development environment is properly configured.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some validations failed.');
    console.log('Please review the configuration and try again.');
    process.exit(1);
  }
}

main().catch(console.error);