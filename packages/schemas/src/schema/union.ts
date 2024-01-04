import { Narrow } from '@palmares/core';

import { getDefaultAdapter } from '../conf';
import Schema from './schema';
import {
  defaultTransform,
  getTranslatedSchemaFromAdapter,
  transformSchemaAndCheckIfShouldBeHandledByFallbackOnComplexSchemas,
} from '../utils';

import type FieldAdapter from '../adapter/fields';
import type { DefinitionsOfSchemaType } from './types';
import { unionValidation } from '../validators/union';
import Validator from '../validators/utils';

export default class UnionSchema<
  TType extends {
    input: Record<any, any>;
    validate: Record<any, any>;
    internal: Record<any, any>;
    representation: Record<any, any>;
    output: Record<any, any>;
  } = {
    input: Record<any, any>;
    output: Record<any, any>;
    validate: Record<any, any>;
    internal: Record<any, any>;
    representation: Record<any, any>;
  },
  TDefinitions extends DefinitionsOfSchemaType = DefinitionsOfSchemaType,
  TSchemas extends readonly [Schema<any, any>, Schema<any, any>, ...Schema<any, any>[]] = [
    Schema<any, any>,
    Schema<any, any>,
    ...Schema<any, any>[],
  ],
> extends Schema<TType, TDefinitions> {
  protected __schemas = new Set<Schema<any>>();

  constructor(schemas: TSchemas) {
    super();
    this.__schemas = new Set(schemas);
  }

  async _transformToAdapter(
    options: Parameters<Schema['_transformToAdapter']>[0]
  ): Promise<ReturnType<FieldAdapter['translate']>> {
    const translatedSchemaOfAdapter = getTranslatedSchemaFromAdapter(
      this.__adapters[options.validationKey as symbol],
      'union'
    );

    if (translatedSchemaOfAdapter === undefined) {
      const promises: Promise<any>[] = [];
      let shouldHandleByFallback = false;
      for (const schemaToTransform of this.__schemas.values()) {
        const awaitableTransformer = async () => {
          const [transformedData, shouldAddFallbackValidationForThisKey] =
            await transformSchemaAndCheckIfShouldBeHandledByFallbackOnComplexSchemas(schemaToTransform, options);
          if (shouldAddFallbackValidationForThisKey) shouldHandleByFallback = true;
          return transformedData;
        };
        promises.push(awaitableTransformer());
      }

      const transformedSchemas = await Promise.all(promises);
      if (shouldHandleByFallback)
        Validator.createAndAppendFallback(
          this,
          unionValidation(
            Array.from(this.__schemas) as unknown as readonly [
              Schema<any, any>,
              Schema<any, any>,
              ...Schema<any, any>[],
            ],
            typeof this?.__adapters?.default?.union?.parse === 'function',
            options
          ),
          {
            at: 0,
            removeCurrent: true,
          }
        );

      return defaultTransform(
        'union',
        this,
        {
          nullable: this.__nullable,
          optional: this.__optional,
          schemas: transformedSchemas,
        },
        {},
        { fallbackTranslatedSchema: transformedSchemas[0], validationKey: options.validationKey as symbol }
      );
    }
    return translatedSchemaOfAdapter;
  }

  static new<
    TSchemas extends readonly [Schema<any, any>, Schema<any, any>, ...Schema<any, any>[]],
    TDefinitions extends DefinitionsOfSchemaType = DefinitionsOfSchemaType,
  >(schemas: Narrow<TSchemas>): UnionSchema<TSchemas[number]['__types']> {
    const result = new UnionSchema<TSchemas[number]['__types'], TDefinitions, TSchemas>(schemas as TSchemas);

    const DefaultAdapterClass = getDefaultAdapter();
    const adapterInstance = new DefaultAdapterClass();
    result.__adapters.default = adapterInstance;

    return result;
  }
}
