import { models } from "@palmares/databases";
import { Sequelize, ModelOptions, ModelAttributeColumnOptions, Model, ModelStatic, ModelCtor, OrderItem } from "sequelize";

import SequelizeEngine from "./engine";
import SequelizeEngineFields from "./fields";
import { ModelTranslatorIndexesType } from "./types";

/**
 * This class is used to create a sequelize model from the default model definition.
 */
export default class ModelTranslator {
  engine: SequelizeEngine;
  fields: SequelizeEngineFields;
  sequelize: Sequelize;
  #indexes: ModelTranslatorIndexesType = {};

  constructor(engine: SequelizeEngine, fields: SequelizeEngineFields) {
    this.engine = engine;
    this.fields = fields;
    this.sequelize = engine.sequelizeInstance as Sequelize;
  }

  async #translateOptions(model: models.Model): Promise<ModelOptions> {
    const modelName = model.name;
    const options = model.options;
    const indexes = this.#indexes[modelName] ? this.#indexes[modelName] : [];
    return {
      underscored: options.underscored,
      indexes: indexes,
      timestamps: false,
      tableName: options.tableName,
      ...options.customOptions
    };
  }

  async #translateOrdering(originalModel: models.Model, translatedModel: ModelCtor<Model>) {
    const translatedOrdering: OrderItem[] = (originalModel.options.ordering || [])?.map(order => {
      const isDescending = order.startsWith('-');
      return isDescending ? [order.substring(1), 'DESC'] : [order, 'ASC'];
    });

    if (translatedOrdering.length > 0) {
      translatedModel.addScope('defaultScope', {
        order: translatedOrdering || []
      }, { override: true });
    }
  }

  async #translateFields(model: models.Model) {
    let translatedFields: { [key: string]: ModelAttributeColumnOptions } = {};
    const fieldsEntries = Object.keys(model.fields);
    for (const fieldName of fieldsEntries) {
      const translatedAttributes = await this.fields.get(fieldName);
      const isTranslatedAttributeDefined = translatedAttributes !== null &&
        typeof translatedAttributes === "object";
      if (isTranslatedAttributeDefined) translatedFields[fieldName] = translatedAttributes;
    }
    return translatedFields;
  }

  async translate(model: models.Model): Promise<ModelCtor<Model> | undefined> {
    const translatedOptions = await this.#translateOptions(model);
    const translatedAttributes = await this.#translateFields(model);

    translatedOptions.indexes = await this.fields.getIndexes(model.name);

    const translatedModel = this.engine.sequelizeInstance?.define(model.name, translatedAttributes, translatedOptions);

    if (translatedModel !== undefined) await this.#translateOrdering(model, translatedModel);
    return translatedModel;
  }
}
