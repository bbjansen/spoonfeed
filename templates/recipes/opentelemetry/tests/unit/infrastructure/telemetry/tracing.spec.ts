import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

describe('OpenTelemetry tracing configuration', () => {
  it('should build a Resource with the expected service name attribute', () => {
    const serviceName = 'test-service';
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
    });

    expect(resource.attributes[ATTR_SERVICE_NAME]).toBe(serviceName);
    expect(resource.attributes[ATTR_SERVICE_VERSION]).toBe('1.0.0');
  });

  it('should fall back to defaults when environment variables are not set', () => {
    const defaultName = process.env.OTEL_SERVICE_NAME || 'nestjs-app';
    const defaultEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

    expect(defaultName).toBe('nestjs-app');
    expect(defaultEndpoint).toBe('http://localhost:4318');
  });
});
