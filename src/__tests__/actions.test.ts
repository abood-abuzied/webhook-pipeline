import { addTimestamp, uppercaseKeys, filterRequiredField } from '../services/actions';

describe('Action Processors', () => {
  describe('addTimestamp', () => {
    it('should add timestamp to payload', () => {
      const payload = { user: 'john', action: 'login' };
      const result = addTimestamp(payload);

      expect(result.original).toEqual(payload);
      expect((result.processed as any)).toHaveProperty('timestamp');
      expect(result.actionApplied).toBe('add_timestamp');
      expect(typeof (result.processed as any).timestamp).toBe('string');
    });
  });

  describe('uppercaseKeys', () => {
    it('should convert all keys to uppercase', () => {
      const payload = { firstName: 'John', contact: { email: 'john@example.com' } };
      const result = uppercaseKeys(payload);

      expect((result.processed as any)).toHaveProperty('FIRSTNAME');
      expect((result.processed as any)).toHaveProperty('CONTACT');
      expect((result.processed as any).CONTACT).toHaveProperty('EMAIL');
      expect(result.actionApplied).toBe('uppercase_keys');
    });
  });

  describe('filterRequiredField', () => {
    it('should filter payload to required fields', () => {
      const payload = {
        id: '123',
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
        requiredFields: ['id', 'name', 'email']
      };
      const result = filterRequiredField(payload);

      expect((result.processed as any)).toHaveProperty('id');
      expect((result.processed as any)).toHaveProperty('name');
      expect((result.processed as any)).toHaveProperty('email');
      expect((result.processed as any)).not.toHaveProperty('password');
      expect(result.actionApplied).toBe('filter_required_field');
    });
  });
});