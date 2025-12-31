module.exports = function (sequelize) {
  const { Model, DataTypes } = require("sequelize");

  class User extends Model { }

  User.init(
    {
      num: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      userID: {
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
      modelName: "User",
      timestamps: true
    }
  );

  return User;
};
