export type LoginFormErrors = {
  email?: string;
  password?: string;
};

export type RegisterFormErrors = {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(email: string, password: string): LoginFormErrors {
  const errors: LoginFormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required.';
  }

  if (!password.trim()) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateRegisterForm(
  username: string,
  email: string,
  password: string,
  confirmPassword: string
): RegisterFormErrors {
  const errors: RegisterFormErrors = {};

  if (username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters.';
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}
