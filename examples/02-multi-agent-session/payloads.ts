export const backendTask = {
  task_type: 'api_implementation',
  context: {
    endpoint: '/api/profile',
    methods: ['GET', 'PUT'],
    requirements: ['auth', 'logging', 'validation']
  }
};

export const frontendTask = {
  task_type: 'ui_component',
  context: {
    component: 'ProfileCard',
    framework: 'react',
    props: ['name', 'title', 'email'],
    styling: 'tailwind'
  }
};

export const reviewTask = {
  task_type: 'integration_review',
  context: {
    checklist: ['consistency', 'error_handling', 'accessibility']
  }
};
