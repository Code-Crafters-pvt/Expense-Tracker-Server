import { TokenPayload } from './jwt';
import { IUser } from '../models/User';

export const isTokenVersionValid = (decoded: TokenPayload, user: IUser): boolean => {
  return decoded.tokenVersion !== undefined && decoded.tokenVersion === user.tokenVersion;
};


