import questionmodel from "./src/DB/models/questionmodel.js";

export const medicalHistoryQuestions = [
    // GENERAL
    {
        question: "What is your full name?",
        category: "general",
          type: "general",
         answerType: "text",
        required: true,
        specialization: "general"
    },
    {
        question: "What is your age?",
        category: "general",
          type: "general",
         answerType: "number",
         required: true,
         specialization: "general"
    },
   
    {
        question: "What is your blood type?",
        category: "general",
          type: "general",
  answerType: "single_choice",
        options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        required: true,
        specialization: "general"
    },

    {
        question: "What is the main reason for your visit today?",
        category: "chief_complaint",
          type: "general",
  answerType: "textarea",
        required: true,
        specialization: "general"
    },
    {
        question: "When did the symptoms start?",
        category: "chief_complaint",
          type: "general",
  answerType: "text",
        required: true,
        specialization: "general"
    },
    {
        question: "Are the symptoms constant or intermittent?",
        category: "chief_complaint",
          type: "general",
  answerType: "single_choice",
        options: ["constant", "intermittent"],
        required: true,
        specialization: "general"
    },

    // PAIN
    {
        question: "Do you feel pain?",
        category: "pain_assessment",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Rate your pain from 1 to 10",
        category: "pain_assessment",
          type: "general",
  answerType: "number",
        required: true,
        specialization: "general"
    },
    {
        question: "Where is the pain located?",
        category: "pain_assessment",
          type: "general",
  answerType: "text",
        required: true,
        specialization: "general"
    },
    {
        question: "How would you describe the pain?",
        category: "pain_assessment",
          type: "general",
  answerType: "multi_choice",
        options: ["sharp", "burning", "throbbing", "stabbing", "dull", "cramping"],
        required: true,
        specialization: "general"
    },

    // MEDICAL HISTORY
    {
        question: "Do you have any chronic diseases?",
        category: "medical_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Are you currently taking any medications?",
        category: "medications",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Do you have any allergies?",
        category: "allergies",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },

    // LIFESTYLE
    {
        question: "Do you smoke?",
        category: "lifestyle",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Do you exercise regularly?",
        category: "lifestyle",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },


    {
        question: "What makes the symptoms worse?",
        category: "chief_complaint",
          type: "general",
  answerType: "textarea",
        required: true,
        specialization: "general"
    },
    {
        question: "What makes the symptoms better?",
        category: "chief_complaint",
          type: "general",
  answerType: "textarea",
        required: true,
         specialization: "general"
    },

   

    
    
    {
        question: "Please list your chronic diseases",
        category: "medical_history",
          type: "general",
  answerType: "textarea",
        required: true, 
        specialization: "general"
    },
    {
        question: "Do you have diabetes?",
        category: "medical_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Do you have hypertension?",
        category: "medical_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Do you have heart disease?",
        category: "medical_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Do you have asthma?",
        category: "medical_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Have you ever been hospitalized before?",
        category: "medical_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Have you had any surgeries before?",
        category: "medical_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Please list previous surgeries",
        category: "medical_history",
          type: "general",
  answerType: "textarea",
        required: true,
        specialization: "general"
    },

    {
        question: "Are you currently taking any medications?",
        category: "medications",
          type: "general",
  answerType: "boolean",
        required: true,
         specialization: "general"
    },
    {
        question: "Please list your current medications",
        category: "medications",
          type: "general",
  answerType: "textarea",
        required: true,

    },
    {
        question: "Do you take medications regularly?",
        category: "medications",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },

    {
        question: "Do you have any allergies?",
        category: "allergies",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Please list your allergies",
        category: "allergies",
          type: "general",
  answerType: "textarea",
        required: true,
        specialization: "general"
    },
    {
        question: "Are you allergic to any medications?",
        category: "allergies",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Are you allergic to food or environmental factors?",
        category: "allergies",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },

    {
        question: "Is there any family history of chronic illness?",
        category: "family_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Does anyone in your family have diabetes?",
        category: "family_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Does anyone in your family have hypertension?",
        category: "family_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Does anyone in your family have heart disease?",
        category: "family_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Is there any family history of cancer?",
        category: "family_history",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },


    {
        question: "Do you drink alcohol?",
        category: "lifestyle",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Do you exercise regularly?",
        category: "lifestyle",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "How many hours do you sleep daily?",
        category: "lifestyle",
          type: "general",
  answerType: "number",
        required: true,
        specialization: "general"
    },
    {
        question: "How would you describe your diet?",
        category: "lifestyle",
          type: "general",
  answerType: "single_choice",
        options: ["healthy", "average", "poor"],
        required: true,
        specialization: "general"
    },

    {
        question: "Are you pregnant?",
        category: "women_health",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
   

    {
        question: "Have you been feeling stressed recently?",
        category: "mental_health",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },
    {
        question: "Do you have trouble sleeping?",
        category: "mental_health",
          type: "general",
  answerType: "boolean",
        required: true, 
        specialization: "general"
    },
    {
        question: "Have you experienced anxiety or depression before?",
        category: "mental_health",
          type: "general",
  answerType: "boolean",
        required: true,
        specialization: "general"
    },

    {
        question: "Emergency contact name",
        category: "emergency",
          type: "general",
  answerType: "text",
        required: true,
        specialization: "general"
    },
    {
        question: "Emergency contact phone number",
        category: "emergency",
          type: "general",
  answerType: "text",
        required: true,
        specialization: "general"
    },
    {
        question: "Relationship to emergency contact",
        category: "emergency",
          type: "general",
          answerType: "text",
          required: true,
          specialization: "general"
    }, {
        question: "Do you experience chest pain?",
        category: "cardiology",
        type: "specialized",
        specialization: "cardiology",
        answerType: "boolean",
        isRequired: true
    },
    {
        question: "Do you feel shortness of breath?",
        category: "cardiology",
        type: "specialized",
        specialization: "cardiology",
        answerType: "boolean",
        isRequired: true
    },
    {
        question: "How often do you experience palpitations?",
        category: "cardiology",
        type: "specialized",
        specialization: "cardiology",
        answerType: "single_choice",
        options: ["rarely", "sometimes", "often"],
        isRequired: false
    },
    {
        question: "Do you have a history of heart disease?",
        category: "cardiology",
        type: "specialized",
        specialization: "cardiology",
        answerType: "boolean",
        isRequired: false
    }
];



