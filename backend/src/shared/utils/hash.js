import bcrypt from "bcryptjs";

/**
 * Genera hash de password
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Compara password con hash
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};