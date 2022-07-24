/**
 * Automatically generated by palmares on 2022-07-24T04:44:04.178Z
 */

import { models, actions } from "@palmares/databases"; 

export default {
  name: '001_default_auto_migration_1658637844178',
  database: "default",
  dependsOn: "",
  operations: [
    new actions.CreateModel(
      "User",
      {
        id: new models.fields.AutoField({
          primaryKey: true,
          defaultValue: undefined,
          allowNull: false,
          unique: true,
          dbIndex: true,
          databaseName: "id",
          underscored: true,
          customAttributes: {}
        }),
        firstName: new models.fields.CharField({
          allowBlank: true,
          maxLength: 255,
          primaryKey: false,
          defaultValue: undefined,
          allowNull: false,
          unique: false,
          dbIndex: false,
          databaseName: "first_name",
          underscored: true,
          customAttributes: {}
        }),
        dependsOn: new models.fields.ForeignKeyField({
          relatedTo: "User",
          toField: "id",
          onDelete: models.fields.ON_DELETE.CASCADE,
          customName: undefined,
          relatedName: "userUsers",
          primaryKey: false,
          defaultValue: undefined,
          allowNull: true,
          unique: false,
          dbIndex: false,
          databaseName: "depends_on",
          underscored: true,
          customAttributes: {}
        }),
        lastName: new models.fields.CharField({
          allowBlank: true,
          maxLength: 255,
          primaryKey: false,
          defaultValue: undefined,
          allowNull: true,
          unique: false,
          dbIndex: false,
          databaseName: "last_name",
          underscored: true,
          customAttributes: {}
        }),
        uuid: new models.fields.UUIDField({
          allowBlank: true,
          maxLength: 36,
          autoGenerate: true,
          primaryKey: false,
          defaultValue: undefined,
          allowNull: false,
          unique: false,
          dbIndex: false,
          databaseName: "uuid",
          underscored: true,
          customAttributes: {}
        }),
      },
      {
        abstract: false,
        underscored: true,
        tableName: "user",
        managed: true,
        ordering: [],
        indexes: [],
        databases: ["default"],
        customOptions: {}
      }
    ),
    new actions.CreateModel(
      "Post",
      {
        id: new models.fields.AutoField({
          primaryKey: true,
          defaultValue: undefined,
          allowNull: false,
          unique: true,
          dbIndex: true,
          databaseName: "id",
          underscored: true,
          customAttributes: {}
        }),
        number: new models.fields.IntegerField({
          primaryKey: false,
          defaultValue: 1,
          allowNull: true,
          unique: false,
          dbIndex: false,
          databaseName: "number",
          underscored: true,
          customAttributes: {}
        }),
        userUuid: new models.fields.ForeignKeyField({
          relatedTo: "User",
          toField: "uuid",
          onDelete: models.fields.ON_DELETE.CASCADE,
          customName: undefined,
          relatedName: "userPosts",
          primaryKey: false,
          defaultValue: undefined,
          allowNull: false,
          unique: false,
          dbIndex: false,
          databaseName: "user_uuid",
          underscored: true,
          customAttributes: {}
        }),
      },
      {
        abstract: false,
        underscored: true,
        tableName: "post",
        managed: true,
        ordering: [],
        indexes: [],
        databases: ["default"],
        customOptions: {}
      }
    )
  ]
};
