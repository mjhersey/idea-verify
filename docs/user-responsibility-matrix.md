# User Responsibility Matrix

This matrix defines clear ownership and handoff procedures between users and the
development team, particularly for Story 1.0 and ongoing project
responsibilities.

## **Phase 1: Initial Setup (Story 1.0)**

| **Task Category**          | **User Responsibility**                                                                                               | **Development Team Responsibility**                                                                                          | **Handoff Method**                         | **Timeline** |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------ |
| **LLM Provider Accounts**  | • Create OpenAI account<br/>• Create Anthropic account<br/>• Set up billing/credits<br/>• Document account details    | • Validate API access<br/>• Configure API clients<br/>• Test connectivity<br/>• Set up fallback handling                     | Encrypted file or secure password manager  | Day 1-2      |
| **AWS Infrastructure**     | • Create AWS account<br/>• Set up billing alerts<br/>• Create development IAM user<br/>• Document account ID          | • Configure AWS CDK<br/>• Set up infrastructure<br/>• Configure secrets management<br/>• Test deployments                    | AWS access keys via secure channel         | Day 1-3      |
| **API Keys & Credentials** | • Generate all API keys<br/>• Verify key permissions<br/>• Provide via secure channel<br/>• Confirm rotation schedule | • Store in AWS Secrets Manager<br/>• Configure environment variables<br/>• Test all connections<br/>• Set up rotation alerts | Secure handoff meeting + encrypted storage | Day 2-3      |
| **Security Compliance**    | • Review credential policies<br/>• Approve security procedures<br/>• Confirm GDPR/compliance needs                    | • Implement security measures<br/>• Configure audit logging<br/>• Set up access controls<br/>• Document procedures           | Security review meeting                    | Day 3-4      |

## **Phase 2: Development Support (Ongoing)**

| **Task Category**       | **User Responsibility**                                                                  | **Development Team Responsibility**                                                           | **When Required**     |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------- |
| **Credential Rotation** | • Approve rotation schedule<br/>• Generate new credentials<br/>• Verify new access works | • Update stored credentials<br/>• Test all services<br/>• Update documentation                | Monthly or as needed  |
| **Service Outages**     | • Monitor account status<br/>• Communicate billing issues<br/>• Approve service upgrades | • Implement fallback procedures<br/>• Monitor system health<br/>• Communicate impact to users | During outages        |
| **Billing & Limits**    | • Monitor API usage costs<br/>• Approve limit increases<br/>• Set spending alerts        | • Implement usage monitoring<br/>• Optimize API efficiency<br/>• Report usage metrics         | Monthly review        |
| **Compliance Updates**  | • Review policy changes<br/>• Approve new data handling<br/>• Update agreements          | • Implement technical changes<br/>• Update security measures<br/>• Document compliance        | As regulations change |

## **Escalation Procedures**

| **Scenario**                  | **User Action**                                                                                   | **Development Team Action**                                                                              | **Timeline** |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| **API Keys Not Working**      | • Verify account status<br/>• Check billing<br/>• Regenerate keys if needed                       | • Test with new credentials<br/>• Update configuration<br/>• Verify all services                         | 2-4 hours    |
| **Service Account Suspended** | • Contact provider support<br/>• Resolve billing/policy issues<br/>• Communicate timeline         | • Activate fallback services<br/>• Switch to alternate providers<br/>• Maintain user communication       | 4-24 hours   |
| **Credential Compromise**     | • Report incident immediately<br/>• Revoke compromised credentials<br/>• Generate new credentials | • Emergency credential rotation<br/>• Security audit<br/>• Update all systems                            | 1-2 hours    |
| **Development Blocked**       | • Prioritize credential provision<br/>• Expedite account setup<br/>• Approve emergency procedures | • Communicate blockage impact<br/>• Implement temporary workarounds<br/>• Escalate to project leadership | Same day     |

## **Communication Protocols**

### **Daily Operations:**

- **User → Development:** Slack channel `#project-credentials` for non-urgent
  items
- **Development → User:** Email digest for usage reports and rotation reminders

### **Urgent Issues:**

- **Emergency Contact:** Direct phone/SMS for security incidents
- **Escalation Path:** User → Tech Lead → Project Manager → Executive Sponsor
- **Response Time:** <2 hours for credential issues, <30 minutes for security
  incidents

### **Regular Reviews:**

- **Weekly:** Credential status and usage review
- **Monthly:** Security posture and compliance check
- **Quarterly:** Service optimization and cost review

## **Security Requirements & Handoff Standards**

### **Credential Handoff Security:**

1. **Secure Channel Only:** Encrypted files, password managers, or in-person
   transfer
2. **No Email/Slack:** Never send credentials via email or unencrypted chat
3. **Verification Required:** Development team confirms receipt and
   functionality
4. **Immediate Deletion:** User deletes local copies after successful handoff
5. **Audit Trail:** All handoffs logged with timestamps and participants

### **User Security Responsibilities:**

- Use strong, unique passwords for all service accounts
- Enable 2FA/MFA where available
- Never share credentials outside approved handoff procedures
- Report suspicious account activity immediately
- Review service access logs monthly

### **Development Team Security Responsibilities:**

- Store all credentials in AWS Secrets Manager only
- Never log credentials in application logs
- Implement credential rotation automation
- Monitor for unusual API usage patterns
- Maintain access audit logs

## **Success Criteria for User Responsibility Matrix:**

✅ **User understands exactly what they must do and when**  
✅ **Development team knows what to expect and when to expect it**  
✅ **Clear handoff procedures prevent security risks**  
✅ **Escalation paths ensure quick resolution of blocking issues**  
✅ **Ongoing responsibilities prevent system degradation**

---

## **Detailed Setup Instructions**

### **LLM Provider Account Setup**

#### **OpenAI Account Creation:**

1. Visit https://platform.openai.com/signup
2. Create account with business email address
3. Verify email and complete profile
4. Navigate to "API Keys" section
5. Generate new API key with appropriate permissions
6. Set up billing and add payment method
7. Configure usage limits and alerts
8. Document account details in secure location

#### **Anthropic Account Creation:**

1. Visit https://console.anthropic.com/signup
2. Create account with same business email
3. Complete organization profile
4. Request API access (may require approval)
5. Generate Claude API key
6. Set up billing and usage monitoring
7. Document account credentials securely

### **AWS Account Setup**

#### **Account Creation:**

1. Visit https://aws.amazon.com/
2. Create new AWS account with business email
3. Provide billing information and verify identity
4. Set up billing alerts for $50, $100, $200 thresholds
5. Enable CloudTrail for audit logging
6. Create IAM user for development with programmatic access
7. Generate access keys and download securely
8. Document account ID and user details

### **Secure Credential Handoff Process**

#### **Preparation Steps:**

1. Create encrypted ZIP file with all credentials
2. Use strong password (minimum 16 characters)
3. Include document with context and instructions
4. Verify all credentials work before handoff

#### **Handoff Meeting:**

1. Schedule secure video call with development team
2. Share encrypted file through secure file sharing service
3. Provide decryption password verbally during call
4. Verify development team can access all services
5. Delete local copies of credentials immediately
6. Document handoff completion with timestamps

#### **Post-Handoff Verification:**

1. Development team confirms all services accessible
2. Test API calls with provided credentials
3. Verify AWS infrastructure can be provisioned
4. Confirm secrets stored in AWS Secrets Manager
5. Send confirmation email to user with next steps
