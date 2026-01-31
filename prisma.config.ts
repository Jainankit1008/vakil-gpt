import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    // This is where the URL lives now
    url: "file:./dev.db"
  }
});