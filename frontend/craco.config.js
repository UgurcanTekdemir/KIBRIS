// craco.config.js
const path = require("path");
const webpack = require("webpack");
const fs = require("fs");

// Load .env file explicitly - read it directly to ensure it's loaded
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
  // Also read and parse manually to ensure it works
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  });
  console.log('✅ Loaded .env file - REACT_APP_* vars:', 
    Object.keys(process.env).filter(k => k.startsWith('REACT_APP_')).length);
}

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: false, // Disabled - Emergent removed
};

// Conditionally load visual edits modules only in dev mode
let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Manually inject REACT_APP_* environment variables into webpack
      // This is necessary because Create React App's automatic .env loading may not work with craco
      
      // Read .env file directly in webpack config to ensure it's loaded
      const envFile = path.resolve(__dirname, '.env');
      let envVarsFromFile = {};
      
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        envContent.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0 && key.startsWith('REACT_APP_')) {
              const value = valueParts.join('=').trim();
              envVarsFromFile[key.trim()] = value;
            }
          }
        });
      }
      
      // Also get from process.env (in case env-cmd loaded them)
      const reactAppEnvVars = {};
      const reactAppKeys = Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'));
      
      // Merge: file values take priority, then process.env
      Object.keys(envVarsFromFile).forEach(key => {
        reactAppEnvVars[`process.env.${key}`] = JSON.stringify(envVarsFromFile[key]);
      });
      
      reactAppKeys.forEach(key => {
        if (!reactAppEnvVars[`process.env.${key}`]) {
          reactAppEnvVars[`process.env.${key}`] = JSON.stringify(process.env[key]);
        }
      });

      console.log('🔧 Webpack Config - Found REACT_APP_* vars from file:', Object.keys(envVarsFromFile).length);
      console.log('🔧 Webpack Config - Found REACT_APP_* vars from process.env:', reactAppKeys.length);
      console.log('🔧 Webpack Config - Total vars to inject:', Object.keys(reactAppEnvVars).length);

      // Remove ALL DefinePlugin instances first
      const originalPluginsLength = webpackConfig.plugins.length;
      webpackConfig.plugins = webpackConfig.plugins.filter(
        plugin => !plugin || !plugin.constructor || plugin.constructor.name !== 'DefinePlugin'
      );
      const removedCount = originalPluginsLength - webpackConfig.plugins.length;
      console.log('🔧 Webpack Config - Removed', removedCount, 'existing DefinePlugin(s)');

      // Create our own DefinePlugin with all necessary vars
      // Build process.env object
      const processEnvObj = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PUBLIC_URL: process.env.PUBLIC_URL || '',
      };
      
      // Add all REACT_APP_* vars to process.env object
      Object.keys(envVarsFromFile).forEach(key => {
        processEnvObj[key] = envVarsFromFile[key];
      });
      
      reactAppKeys.forEach(key => {
        if (!processEnvObj[key]) {
          processEnvObj[key] = process.env[key];
        }
      });
      
      // Build all environment variables for DefinePlugin
      // DefinePlugin expects string values that will be inlined
      const allEnvVars = {
        // Define process.env as an object (Webpack will inline this)
        'process.env': JSON.stringify(processEnvObj),
        // Also define individual process.env.* for backward compatibility
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        'process.env.PUBLIC_URL': JSON.stringify(process.env.PUBLIC_URL || ''),
        // Add all REACT_APP_* vars as individual properties
        ...reactAppEnvVars
      };

      // Add our DefinePlugin at the beginning to ensure it's processed first
      webpackConfig.plugins.unshift(new webpack.DefinePlugin(allEnvVars));
      
      console.log('🔧 Webpack Config - Added DefinePlugin with', Object.keys(allEnvVars).length, 'vars');
      console.log('🔧 Webpack Config - Sample injected vars:', Object.keys(reactAppEnvVars).slice(0, 3));

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

// Only add babel metadata plugin during dev server
if (config.enableVisualEdits && babelMetadataPlugin) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

webpackConfig.devServer = (devServerConfig) => {
  // Apply visual edits dev server setup only if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
