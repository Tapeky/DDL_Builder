import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const configured = process.env.ADMIN_TOKEN?.trim();
    if (!configured) {
      throw new ServiceUnavailableException('Le back-office n’est pas configuré.');
    }
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const value = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const expected = Buffer.from(configured);
    const received = Buffer.from(value);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException('Jeton du back-office invalide.');
    }
    return true;
  }
}
