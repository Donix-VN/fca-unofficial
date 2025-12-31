const { Sequelize } = require("sequelize");
const fs = require("fs");
const path = require("path");

let sequelize = null;
let models = {};

try {
  const databasePath = path.join(process.cwd(), "Fca_Database");
  if (!fs.existsSync(databasePath)) {
    fs.mkdirSync(databasePath, { recursive: true });
  }

  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: path.join(databasePath, "database.sqlite"),
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      max: 3
    },
    dialectOptions: {
      timeout: 5000
    },
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
  });

  // Load models with error handling
  try {
    const modelFiles = fs.readdirSync(__dirname)
      .filter(file => file.endsWith(".js") && file !== "index.js");

    for (const file of modelFiles) {
      try {
        const model = require(path.join(__dirname, file))(sequelize);
        if (model && model.name) {
          models[model.name] = model;
        }
      } catch (modelError) {
        // Log but continue loading other models
        console.error(`Failed to load model ${file}:`, modelError && modelError.message ? modelError.message : String(modelError));
      }
    }

    // Associate models
    Object.keys(models).forEach(modelName => {
      try {
        if (models[modelName].associate) {
          models[modelName].associate(models);
        }
      } catch (assocError) {
        console.error(`Failed to associate model ${modelName}:`, assocError && assocError.message ? assocError.message : String(assocError));
      }
    });
  } catch (loadError) {
    console.error("Failed to load models:", loadError && loadError.message ? loadError.message : String(loadError));
  }

  models.sequelize = sequelize;
  models.Sequelize = Sequelize;
  models.syncAll = async () => {
    try {
      if (!sequelize) {
        throw new Error("Sequelize instance not initialized");
      }
      await sequelize.sync({ force: false });
    } catch (error) {
      console.error("Failed to synchronize models:", error && error.message ? error.message : String(error));
      throw error;
    }
  };
} catch (initError) {
  // If initialization fails completely, still export a valid structure
  console.error("Database initialization error:", initError && initError.message ? initError.message : String(initError));
  models.sequelize = null;
  models.Sequelize = Sequelize;
  models.syncAll = async () => {
    throw new Error("Database not initialized");
  };
}

module.exports = models;
