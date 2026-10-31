const protectedOperation = (summary: string) => ({
  summary,
  security: [{ bearerAuth: [] }],
  responses: {
    '200': { description: 'Request completed successfully.' },
    '201': { description: 'Resource created successfully.' },
    '401': { description: 'Authentication is required.' },
    '403': { description: 'The current user is not authorized.' },
    '500': { description: 'Unexpected server error.' }
  }
});

const publicOperation = (summary: string) => ({
  ...protectedOperation(summary),
  security: []
});

const requestOperation = (summary: string, isPublic = false) => ({
  ...(isPublic ? publicOperation(summary) : protectedOperation(summary)),
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: { type: 'object', additionalProperties: true }
      }
    }
  }
});

const itemPath = (label: string, method: 'put' | 'patch' | 'delete') => ({
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  [method]: protectedOperation(`${method === 'delete' ? 'Delete' : 'Update'} ${label}`)
});

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Brightloop Subscription Management API',
    version: '1.0.0',
    description: 'API for subscription, customer, invoicing, billing, and financial management.'
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Authentication' },
    { name: 'Customers' },
    { name: 'Catalog' },
    { name: 'Subscriptions' },
    { name: 'Billing' },
    { name: 'Administration' },
    { name: 'Reporting' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: { error: { type: 'string' } }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' }
        }
      }
    }
  },
  paths: {
    '/api/auth/login': { post: { ...publicOperation('Sign in'), tags: ['Authentication'], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } } } },
    '/api/auth/register': { post: requestOperation('Register a customer account', true) },
    '/api/auth/forgot-password': { post: requestOperation('Request a password reset', true) },
    '/api/auth/reset-password': { post: requestOperation('Reset a password', true) },
    '/api/auth/me': { get: protectedOperation('Get the current user') },
    '/api/auth/update-profile': { put: protectedOperation('Update the current user profile') },
    '/api/staff': { get: protectedOperation('List staff'), post: requestOperation('Create a staff account') },
    '/api/staff/{id}': { patch: requestOperation('Update a staff account') },
    '/api/customers': {
      get: protectedOperation('List customers'),
      post: requestOperation('Create customers')
    },
    '/api/customers/{id}': {
      ...itemPath('customer', 'put'),
      put: requestOperation('Update customer')
    },
    '/api/products': { get: publicOperation('List products'), post: requestOperation('Create a product') },
    '/api/products/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      put: requestOperation('Update product'),
      delete: protectedOperation('Delete a product')
    },
    '/api/plans': { get: publicOperation('List subscription plans'), post: requestOperation('Create a subscription plan') },
    '/api/plans/{id}': {
      ...itemPath('subscription plan', 'put'),
      put: requestOperation('Update subscription plan')
    },
    '/api/quotation-templates': {
      get: protectedOperation('List quotation templates'),
      post: requestOperation('Create a quotation template')
    },
    '/api/quotation-templates/{id}': {
      ...itemPath('quotation template', 'delete'),
      put: requestOperation('Update a quotation template')
    },
    '/api/quotation-templates/{id}/duplicate': { post: requestOperation('Duplicate a quotation template') },
    '/api/subscriptions': { get: protectedOperation('List subscriptions'), post: requestOperation('Create a subscription') },
    '/api/subscriptions/{id}/transition': { post: requestOperation('Transition a subscription status') },
    '/api/taxes': { get: publicOperation('List taxes'), post: requestOperation('Create a tax') },
    '/api/taxes/{id}': {
      ...itemPath('tax', 'put'),
      put: requestOperation('Update tax')
    },
    '/api/discounts': { get: publicOperation('List discounts'), post: requestOperation('Create a discount') },
    '/api/discounts/{id}': {
      ...itemPath('discount', 'put'),
      put: requestOperation('Update discount')
    },
    '/api/discounts/validate': { post: requestOperation('Validate a discount code', true) },
    '/api/invoices': { get: protectedOperation('List invoices'), post: requestOperation('Create an invoice') },
    '/api/invoices/{id}': { get: protectedOperation('Get an invoice') },
    '/api/invoices/{id}/status': { patch: requestOperation('Update invoice status') },
    '/api/billing/run-recurring': { post: requestOperation('Run recurring billing') },
    '/api/payments': { get: protectedOperation('List payments'), post: requestOperation('Record a payment') },
    '/api/dashboard': { get: protectedOperation('Get dashboard metrics') },
    '/api/reports': { get: protectedOperation('Get financial reports') }
  }
};
