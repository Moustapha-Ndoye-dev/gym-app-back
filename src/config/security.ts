const WEAK_BOOTSTRAP_PASSWORDS = new Set([
  'admin',
  'superpro2027',
  'password',
  'password123',
  'changeme',
  'change-me',
  'replace-me',
  'replace_with_a_strong_password',
]);

const WEAK_JWT_SECRETS = new Set([
  'your_super_secret_jwt_key_here',
  'changeme',
  'change-me',
  'replace-me',
  'replace_with_a_long_random_secret',
]);

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret || WEAK_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new Error(
      'JWT_SECRET must be set to a non-placeholder value before authentication can be used.'
    );
  }

  return secret;
};

export const getBootstrapPassword = (envKey: string) => {
  const password = process.env[envKey]?.trim();

  if (!password) {
    return null;
  }

  if (
    password.length < 10 ||
    WEAK_BOOTSTRAP_PASSWORDS.has(password.toLowerCase())
  ) {
    return null;
  }

  return password;
};
