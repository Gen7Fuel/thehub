import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const route = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../routes/auth.js'),
  'utf8',
);
const authRoute = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../auth-backend/routes/auth.js'),
  'utf8',
);
const authLogger = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../auth-backend/utils/authLogger.js'),
  'utf8',
);
const authAccessLogger = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../auth-backend/middleware/authAccessLogger.js'),
  'utf8',
);
const authApp = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../auth-backend/app.js'),
  'utf8',
);
const activeMainAuthRoute = route
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('Self-service password change logging contract', () => {
  it('records a redacted ChangeLog entry for the authenticated mutation', () => {
    const start = route.indexOf("router.post('/change-password-self'");
    const end = route.indexOf("router.post('/reset-password'", start);
    const source = route.slice(start, end);

    expect(source).toContain('await logChange(req');
    expect(source).toContain("resourceType: 'user-credential'");
    expect(source).toContain("source: 'settings.reset-password'");
    expect(source).toContain("before: '[REDACTED]'");
    expect(source).toContain("after: '[REDACTED]'");
    expect(source).not.toContain('before: currentPassword');
    expect(source).not.toContain('after: cleanNewPassword');
  });
});

describe('Navbar logout logging contract', () => {
  it('keeps the route active and records the user state mutation', () => {
    const start = activeMainAuthRoute.indexOf('router.post("/logout"');
    const end = activeMainAuthRoute.indexOf("router.post('/change-password-self'", start);
    const source = activeMainAuthRoute.slice(start, end);

    expect(source).toContain('await logChange(req');
    expect(source).toContain("source: req.headers['x-action-source'] || 'navbar.session'");
    expect(source).toContain("path: 'is_loggedIn'");
    expect(source).toContain('after: false');
  });
});

describe('Public authentication logging contract', () => {
  it('retires public auth routes from the main backend', () => {
    expect(route).toContain('RETIRED: public identity lookup moved to auth-backend');
    expect(route).toContain('RETIRED: public registration moved to auth-backend');
    expect(route).toContain('RETIRED: public login moved to auth-backend');
    expect(route).toContain('RETIRED: token refresh moved to auth-backend');
    expect(route).toContain("router.post('/change-password-self'");
    expect(route).toContain("router.post('/reset-password'");
    expect(activeMainAuthRoute).not.toContain('router.post("/identify"');
    expect(activeMainAuthRoute).not.toContain('router.post("/register"');
    expect(activeMainAuthRoute).not.toContain('router.post("/login"');
    expect(activeMainAuthRoute).not.toContain('router.post("/refresh-token"');
    expect(activeMainAuthRoute).toContain('router.post("/logout"');
    expect(activeMainAuthRoute).toContain("router.post('/change-password-self'");
    expect(activeMainAuthRoute).toContain("router.post('/reset-password'");
    expect(activeMainAuthRoute).toContain('router.post("/verify-password"');
  });

  it('records redacted registration and login events in auth-backend', () => {
    expect(authRoute).toContain("source: req.headers['x-action-source'] || 'register.page'");
    expect(authRoute).toContain('message: `New user registered: ${normalizedEmail}`');
    expect(authRoute).toContain("username: 'unknown'");
    expect(authRoute).toContain("resourceType: 'user'");
    expect(authRoute).toContain('message: `User logged in: ${user.email}`');
    expect(authRoute).toContain('delete safeUser.password');
    expect(authRoute).not.toContain('password: password');
  });

  it('uses the shared auth logger without persisting request credentials', () => {
    expect(authRoute).toContain("const { logAuthChange } = require('../utils/authLogger');");
    expect(authRoute).toContain("message: `New user registered: ${normalizedEmail}`");
    expect(authRoute).toContain("message: `User logged in: ${user.email}`");
    expect(authLogger).not.toContain('req.body.password');
    expect(authLogger).not.toContain('password:');
  });

  it('uses the shared backend logging models mounted into auth-backend', () => {
    expect(authRoute).toContain('require("../models/User")');
    expect(authLogger).toContain("require('../models/ChangeLog')");
    expect(authLogger).toContain("resourceStore: 'mongodb'");
  });

  it('persists auth history without blocking login or registration', () => {
    expect(authRoute).not.toContain('await logAuthChange(req');
    expect(authLogger).toContain('setImmediate(() =>');
    expect(authLogger).toContain('Auth ChangeLog disabled: shared model could not be loaded:');
    expect(authLogger).toContain('Auth change log persistence failed:');
  });

  it('records auth attempts and failures asynchronously without reading credentials', () => {
    expect(authApp).toContain('app.use(authAccessLogger());');
    expect(authAccessLogger).toContain("require('../models/AccessLog')");
    expect(authAccessLogger).toContain("path === '/login-auth/health'");
    expect(authAccessLogger).toContain("path === '/login-auth/maintenance-status' && res.statusCode < 400");
    expect(authAccessLogger).toContain("setImmediate(() =>");
    expect(authAccessLogger).not.toContain('req.body.password');
    expect(authAccessLogger).not.toContain('password:');
  });

  it('uses trusted-proxy client IPs and generated request IDs in auth logs', () => {
    expect(authApp).toContain("app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])");
    expect(authApp).toContain('app.use(requestId());');
    expect(authLogger).toContain('ip: getClientIp(req)');
    expect(authLogger).toContain('requestId: req.requestId');
    expect(authAccessLogger).toContain('ip: getClientIp(req)');
    expect(authAccessLogger).toContain('requestId: req.requestId');
  });
});
