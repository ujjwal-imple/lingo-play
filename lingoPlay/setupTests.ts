import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Ensure DOM is reset between tests to avoid duplicate queries
afterEach(() => {
  cleanup();
});


