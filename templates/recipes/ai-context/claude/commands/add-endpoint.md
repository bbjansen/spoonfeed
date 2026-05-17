# Add API Endpoint

Scaffold a new REST API endpoint with controller, service, DTOs, and tests.

## Prompt

Ask the user for:

1. **Resource name** (singular, e.g. `invoice`)
2. **HTTP methods** to include (default: CRUD — GET list, GET by ID, POST, PATCH, DELETE)

## Steps

1. **Create the module directory** at `src/<resource>/`

2. **Create the DTOs** in `src/<resource>/dto/`:
   - `create-<resource>.dto.ts` — request body for POST
   - `update-<resource>.dto.ts` — request body for PATCH (PartialType of create DTO)
   - `<resource>.response.dto.ts` — response shape

   ```ts
   import { IsString, IsNotEmpty } from 'class-validator';
   import { ApiProperty } from '@nestjs/swagger';

   export class CreateInvoiceDto {
     @ApiProperty({ description: 'Invoice number' })
     @IsString()
     @IsNotEmpty()
     number: string;
   }
   ```

3. **Create the service** at `src/<resource>/<resource>.service.ts`:
   - One public method per endpoint
   - Inject repository or data source as needed
   - Keep under 200 lines — extract helpers to separate classes

4. **Create the controller** at `src/<resource>/<resource>.controller.ts`:
   - Use `@ApiTags('<resource>')` for Swagger grouping
   - Use `@ApiOperation()` on each method
   - Delegate all logic to the service

   ```ts
   @ApiTags('invoices')
   @Controller('invoices')
   export class InvoiceController {
     constructor(private readonly invoiceService: InvoiceService) {}

     @Get()
     @ApiOperation({ summary: 'List all invoices' })
     findAll(): Promise<InvoiceResponseDto[]> {
       return this.invoiceService.findAll();
     }
   }
   ```

5. **Create the module** at `src/<resource>/<resource>.module.ts`:
   - Register the controller and service as providers
   - Export the service if other modules need it

6. **Register in parent module** — add the new module to the `imports` array of `AppModule` or the relevant feature module

7. **Create test stubs**:
   - `tests/unit/<resource>/<resource>.service.spec.ts`
   - `tests/unit/<resource>/<resource>.controller.spec.ts`
   - Each test file should have `describe` blocks for every public method
   - Include at least: happy path, invalid input, and not-found cases

8. **Verify** — run `pnpm build` and `pnpm test` to confirm everything compiles and tests pass
