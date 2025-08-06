/**
 * Tests for User Account Setup Validation Script
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'child_process'

describe('User Account Validation Script', () => {
  let mockProcess

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (mockProcess && !mockProcess.killed) {
      mockProcess.kill()
    }
  })

  it('should exit with code 0 when all accounts are validated', done => {
    const process = spawn('node', ['tools/validate-user-accounts.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Simulate user saying yes to all questions
    const responses = ['y\n', 'y\n', 'y\n', 'y\n', 'y\n']
    let responseIndex = 0

    process.stdout.on('data', data => {
      const output = data.toString()
      if (output.includes('? (y/n):') && responseIndex < responses.length) {
        process.stdin.write(responses[responseIndex])
        responseIndex++
      }
    })

    process.on('close', code => {
      expect(code).toBe(0)
      done()
    })

    process.on('error', done)
  }, 10000)

  it('should exit with code 1 when some accounts are not set up', done => {
    const process = spawn('node', ['tools/validate-user-accounts.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Simulate user saying no to first question, yes to others
    const responses = ['n\n', 'y\n', 'y\n', 'y\n', 'y\n']
    let responseIndex = 0

    process.stdout.on('data', data => {
      const output = data.toString()
      if (output.includes('? (y/n):') && responseIndex < responses.length) {
        process.stdin.write(responses[responseIndex])
        responseIndex++
      }
    })

    process.on('close', code => {
      expect(code).toBe(1)
      done()
    })

    process.on('error', done)
  }, 10000)

  it('should handle SIGINT gracefully', done => {
    const process = spawn('node', ['tools/validate-user-accounts.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    setTimeout(() => {
      process.kill('SIGINT')
    }, 1000)

    process.on('close', code => {
      expect(code).toBe(130)
      done()
    })

    process.on('error', done)
  }, 5000)

  it('should display all validation checklist items', done => {
    const process = spawn('node', ['tools/validate-user-accounts.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let output = ''

    process.stdout.on('data', data => {
      output += data.toString()
    })

    // Kill after getting initial output
    setTimeout(() => {
      process.kill('SIGINT')
    }, 1000)

    process.on('close', () => {
      expect(output).toContain('OpenAI account')
      expect(output).toContain('Anthropic account')
      expect(output).toContain('AWS account')
      expect(output).toContain('billing alerts')
      expect(output).toContain('documented account details')
      done()
    })

    process.on('error', done)
  }, 5000)
})
