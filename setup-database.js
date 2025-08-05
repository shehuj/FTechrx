const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./patient_data.db');

db.serialize(() => {
    // Create surveys table
    db.run(`
        CREATE TABLE IF NOT EXISTS surveys (
            survey_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            study_id TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create indexes for surveys table
    db.run(`CREATE INDEX IF NOT EXISTS idx_surveys_study_id ON surveys(study_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_surveys_patient_id ON surveys(patient_id)`);

    // Create responses table
    db.run(`
        CREATE TABLE IF NOT EXISTS responses (
            response_id TEXT PRIMARY KEY,
            survey_id TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            answer TEXT NOT NULL,
            response_type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(survey_id) REFERENCES surveys(survey_id)
        )
    `);

    // Create index for responses table
    db.run(`CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON responses(survey_id)`);

    console.log('Database tables created successfully');
});

db.close();