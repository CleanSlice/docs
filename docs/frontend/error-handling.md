# Error Handling

CleanSlice provides centralized error handling through three cooperating pieces: an **error store** for state management, a **`useError` composable** for component-level errors, and a **`handleError` utility** that catches API errors globally and shows toast notifications with i18n-translated messages.

## Architecture

When an API call fails, the error flows through a pipeline:

```
API call fails
    |
    v
Axios interceptor catches the error
    |
    v
handleError() utility
    |-- 401? --> attempt token refresh --> if failed, logout
    |-- Has error code? --> look up i18n: {CODE}_title, {CODE}_description
    |-- Show toast notification
    v
User sees translated error message
```

For component-level errors (form validation, business logic), you use the `useError` composable to store and display errors per key.

## Slice Structure

```
slices/setup/error/
├── nuxt.config.ts              # Slice config + #error alias
├── stores/
│   └── error.ts                # Pinia error store
├── composables/
│   └── useError.ts             # Error composable
├── utils/
│   └── handleError.ts          # Global error handler (toasts)
└── locales/
    └── en.json                 # Base error translations
```

## Configuration

```typescript [slices/setup/error/nuxt.config.ts]
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  alias: {
    '#error': currentDir,
  },
  i18n: {
    langDir: '../locales',
    locales: [{ code: 'en', file: 'en.json' }],
  },
});
```

## Error Store

The error store manages both keyed errors (for form fields, specific operations) and a global error:

```typescript [slices/setup/error/stores/error.ts]
import { defineStore } from 'pinia';

export interface ErrorInfo {
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface ErrorOptions {
  metadata?: Record<string, unknown>;
  isGlobal?: boolean;
}

interface ErrorState {
  errors: Record<string, ErrorInfo>;
  globalError: ErrorInfo | null;
}

export const useErrorStore = defineStore('error', {
  state: (): ErrorState => ({
    errors: {},
    globalError: null,
  }),

  getters: {
    getError:
      (state) =>
      (key: string): ErrorInfo | null => {
        return state.errors[key] || null;
      },

    hasError:
      (state) =>
      (key: string): boolean => {
        return key in state.errors;
      },

    getGlobalError: (state): ErrorInfo | null => {
      return state.globalError;
    },

    hasGlobalError: (state): boolean => {
      return state.globalError !== null;
    },
  },

  actions: {
    setError(
      key: string,
      message: string,
      options: ErrorOptions = {}
    ): void {
      const error: ErrorInfo = {
        message,
        metadata: options.metadata,
        timestamp: Date.now(),
      };

      if (options.isGlobal) {
        this.globalError = error;
      } else {
        this.errors[key] = error;
      }
    },

    clearError(key: string): void {
      delete this.errors[key];
    },

    clearGlobalError(): void {
      this.globalError = null;
    },

    clearAllErrors(): void {
      this.errors = {};
      this.globalError = null;
    },

    setApiError(
      key: string,
      error: unknown,
      defaultMessage: string
    ): void {
      let message = defaultMessage;
      let metadata: Record<string, unknown> | undefined;

      if (
        error &&
        typeof error === 'object' &&
        'response' in error
      ) {
        const apiError = error as any;
        if (apiError.response?.data?.message) {
          message = apiError.response.data.message;
          metadata = {
            code: apiError.response.data.code,
            statusCode: apiError.response.data.statusCode,
            originalError: error,
          };
        }
      } else if (error instanceof Error) {
        message = error.message;
        metadata = { stack: error.stack };
      }

      this.setError(key, message, { metadata });
    },
  },
});
```

## useError Composable

The composable wraps the store with a cleaner API for components:

```typescript [slices/setup/error/composables/useError.ts]
export const useError = () => {
  const store = useErrorStore();

  const globalError = computed(() => store.getGlobalError);
  const hasGlobalError = computed(() => store.hasGlobalError);

  const getError = (key: string): ErrorInfo | null => {
    return store.getError(key);
  };

  const hasError = (key: string): boolean => {
    return store.hasError(key);
  };

  const setError = (
    key: string,
    message: string,
    options: ErrorOptions = {}
  ): void => {
    store.setError(key, message, options);
  };

  const clearError = (key: string): void => {
    store.clearError(key);
  };

  const clearAllErrors = (): void => {
    store.clearAllErrors();
  };

  const setApiError = (
    key: string,
    error: unknown,
    defaultMessage: string
  ): void => {
    store.setApiError(key, error, defaultMessage);
  };

  // Wrap an async operation with automatic error handling
  const handleAsync = async <T>(
    key: string,
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      setApiError(key, error, errorMessage);
      return null;
    }
  };

  return {
    globalError,
    hasGlobalError,
    getError,
    hasError,
    setError,
    clearError,
    clearAllErrors,
    setApiError,
    handleAsync,
  };
};
```

::: tip
The `handleAsync` wrapper is useful when you want automatic error capture without writing try/catch in every component.
:::

## handleError Utility

This is the global error handler called by the [API interceptor](/frontend/api-integration). It translates error codes via i18n and shows toast notifications:

```typescript [slices/setup/error/utils/handleError.ts]
import { useToast } from '#theme/components/ui/toast/use-toast';

let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 2;

export const handleError = async (error: any) => {
  const { toast } = useToast();
  const account = useAuthStore();
  const app = useNuxtApp();

  // No response -- network error or similar
  if (!error?.response) {
    throw createError({
      statusCode: 404,
      message: 'Data not found',
    });
  }

  // Handle 401 Unauthorized -- token refresh flow
  if (error.response.status === 401) {
    if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
      refreshAttempts = 0;
      account.logout();
      navigateTo(pages.logout);
      return;
    }

    refreshAttempts++;
    const refreshSuccess = await account.refreshToken();

    if (!refreshSuccess) {
      refreshAttempts = 0;
      navigateTo(pages.logout);
      return;
    }

    refreshAttempts = 0;
    return;
  }

  // Handle errors with an error code from the API
  if (error.response.data.code) {
    const code = error.response.data.code;
    const apiMessage = error.response.data.message;

    // Look up i18n translations using the error code
    let title = app.$i18n.t(`${code}_title`);
    let description =
      apiMessage ||
      app.$i18n.t(`${code}_description`, {
        supportLink:
          '<strong><a href="mailto:support@example.com">support@example.com</a></strong>',
      });

    // Fallback if translation key does not exist
    if (title === `${code}_title`) {
      title = 'Error';
    }
    if (description === `${code}_description` && apiMessage) {
      description = apiMessage;
    }

    toast({
      title,
      description,
      variant: 'destructive',
    });
  }
};
```

### How 401 Handling Works

The 401 flow prevents infinite refresh loops:

1. First 401 received -- attempt to refresh the token
2. If refresh succeeds -- reset counter and retry
3. If refresh fails -- redirect to logout page
4. If 2+ refresh attempts fail -- force logout to break the loop

## Error Translations

Error translations follow a `{CODE}_title` / `{CODE}_description` pattern. These codes match exactly what the NestJS API returns:

```json [slices/setup/error/locales/en.json]
{
  "UNEXPECTED_ERROR_title": "Oops! Something Went Wrong",
  "UNEXPECTED_ERROR_description": "We encountered an unexpected error. Please try again."
}
```

```json [slices/user/auth/locales/en.json]
{
  "USER_EXISTS_title": "User Already Registered",
  "USER_EXISTS_description": "It looks like you already have an account. Please log in.",
  "USER_NOT_FOUND_title": "User Not Found",
  "USER_NOT_FOUND_description": "We couldn't find an account with the provided email.",
  "USER_NOT_AUTHORIZED_title": "Incorrect Email or Password",
  "USER_NOT_AUTHORIZED_description": "Please verify your credentials and try again, or contact {supportLink}.",
  "USER_BANNED_title": "Account Banned",
  "USER_BANNED_description": "Your account has been banned. Please contact {supportLink}."
}
```

The matching flow:

```
NestJS throws: UserNotFoundError(userId)
  --> API response: { code: "USER_NOT_FOUND", message: "...", statusCode: 404 }
  --> handleError: $t('USER_NOT_FOUND_title')  --> "User Not Found"
  --> handleError: $t('USER_NOT_FOUND_description')  --> "We couldn't find..."
  --> Toast appears with translated title and description
```

## Usage Examples

### Form Validation

```vue [components/auth/Form.vue]
<script setup lang="ts">
const { setError, clearError, hasError, getError } = useError();

const validateEmail = (email: string) => {
  clearError('email');

  if (!email) {
    setError('email', 'Email is required');
    return false;
  }

  if (!email.includes('@')) {
    setError('email', 'Invalid email format');
    return false;
  }

  return true;
};
</script>

<template>
  <div>
    <Input v-model="email" @blur="validateEmail(email)" />
    <span v-if="hasError('email')" class="text-sm text-destructive">
      {{ getError('email')?.message }}
    </span>
  </div>
</template>
```

### Async Operation Wrapper

```typescript
const { handleAsync } = useError();

// Wrap an async call -- errors are captured automatically
const user = await handleAsync(
  'fetch-user',
  () => UserService.getUser(id),
  'Failed to fetch user'
);

if (user) {
  // Success -- user data is available
}
```

### Manual Toast Notifications

For custom messages outside the error system, use the toast directly:

```typescript
import { useToast } from '#theme/components/ui/toast/use-toast';

const { toast } = useToast();

// Success message
toast({
  title: 'Saved',
  description: 'Your changes have been saved.',
  variant: 'default',
});

// Error message
toast({
  title: 'Error',
  description: 'Something went wrong.',
  variant: 'destructive',
});
```

## Error Flow Summary

| Error Type | Handler | Output |
|------------|---------|--------|
| API error (4xx/5xx) | `handleError` (interceptor) | Toast notification |
| 401 Unauthorized | `handleError` | Token refresh or logout |
| Form validation | `useError` composable | Per-field error messages |
| Network error | `handleError` | Error page or toast |
| Custom business logic | `useError` composable | Stored in error store |

## What's Next?

- [API Integration](/frontend/api-integration) -- See how the interceptor triggers handleError
- [i18n](/frontend/i18n) -- Learn the error code translation pattern
- [UI Components](/frontend/ui-components) -- Toast notifications come from the theme slice
