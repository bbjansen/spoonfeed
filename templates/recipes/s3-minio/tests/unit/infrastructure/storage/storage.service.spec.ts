import { StorageService } from '../../../../src/infrastructure/storage/storage.service';

describe('StorageService', () => {
  it('should have an upload method', () => {
    expect(StorageService.prototype.upload).toBeDefined();
    expect(typeof StorageService.prototype.upload).toBe('function');
  });

  it('should have a download method', () => {
    expect(StorageService.prototype.download).toBeDefined();
    expect(typeof StorageService.prototype.download).toBe('function');
  });

  it('should have a delete method', () => {
    expect(StorageService.prototype.delete).toBeDefined();
    expect(typeof StorageService.prototype.delete).toBe('function');
  });

  it('should have a getPresignedUrl method', () => {
    expect(StorageService.prototype.getPresignedUrl).toBeDefined();
    expect(typeof StorageService.prototype.getPresignedUrl).toBe('function');
  });
});
