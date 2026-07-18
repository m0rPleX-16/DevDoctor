import type { DiagnosticCheck } from '../../../core/types/diagnostic.js';

export async function checkDjangoSettingsModule(): Promise<DiagnosticCheck> {
  const envVar = process.env.DJANGO_SETTINGS_MODULE;

  if (!envVar) {
    return {
      name: 'django-settings-module',
      label: 'DJANGO_SETTINGS_MODULE Set',
      status: 'warn',
      message: 'DJANGO_SETTINGS_MODULE environment variable is not defined.',
      detail:
        'Django requires the DJANGO_SETTINGS_MODULE environment variable to locate your settings.py module when executing command-line utilities (like manage.py or django-admin) or running wsgi/asgi entry points.',
      suggestion:
        'Set the DJANGO_SETTINGS_MODULE variable in your terminal, shell config (.bashrc/.zshrc), or .env file (e.g. export DJANGO_SETTINGS_MODULE=myproject.settings).',
    };
  }

  return {
    name: 'django-settings-module',
    label: 'DJANGO_SETTINGS_MODULE Set',
    status: 'pass',
    message: `DJANGO_SETTINGS_MODULE is set to "${envVar}".`,
    detail: `Django settings module configuration resolved successfully.`,
  };
}
