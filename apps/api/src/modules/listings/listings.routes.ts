import type { FastifyInstance } from 'fastify';
import { IdParam } from '@hyzmat/shared';
import { parseOrThrow } from '../../lib/validate';
import type { ListingsService } from './listings.service';

export function listingsRoutes(app: FastifyInstance, service: ListingsService) {
  app.get('/listings', (req) => service.feed(req.query, req.user));

  app.get('/me/listings', (req) => service.mine(req.user));

  app.get('/listings/:id', (req) => {
    const { id } = parseOrThrow(IdParam, req.params);
    return service.getById(id, req.user);
  });

  app.post('/listings', async (req, reply) => {
    const dto = await service.create(req.body, req.user);
    return reply.code(201).send(dto);
  });

  app.patch('/listings/:id', (req) => {
    const { id } = parseOrThrow(IdParam, req.params);
    return service.update(id, req.body, req.user);
  });

  app.delete('/listings/:id', async (req, reply) => {
    const { id } = parseOrThrow(IdParam, req.params);
    await service.remove(id, req.user);
    return reply.code(204).send();
  });
}
