module.exports = function(sequelize) {
  const { Model, DataTypes } = require("sequelize");

  class Thread extends Model {}

  Thread.init(
    {
      num: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      threadID: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      data: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const value = this.getDataValue('data');
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        },
        set(value) {
          this.setDataValue('data', typeof value === 'string' ? value : JSON.stringify(value));
        }
      }
    },
    {
      sequelize,
      modelName: "Thread",
      timestamps: true
    }
  );
  return Thread;
};
