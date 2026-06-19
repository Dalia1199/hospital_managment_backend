import drugmodel from "../../DB/models/drugmodel.js";
import { successresponse } from "../../common/utilits/responce.success.js";

// @route   GET /drugs/search?q=xyz
// @desc    Search for drugs by name (debounced autocomplete)
// @access  Private (Doctor)
export const searchDrugs = async (req, res, next) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return successresponse({ res, status: 200, message: "Empty query", data: { drugs: [] } });
        }

        // Case-insensitive regex search
        const regex = new RegExp(q, 'i');
        
        // Find top 10 matching drugs
        const drugs = await drugmodel.find({ name: { $regex: regex } })
            .select("name category")
            .limit(10)
            .lean();

        return successresponse({
            res,
            status: 200,
            message: "Drugs fetched successfully",
            data: { drugs }
        });
    } catch (error) {
        next(error);
    }
};

// @route   POST /drugs/seed
// @desc    Seed the database with initial common drugs
// @access  Public (Utility)
export const seedDrugs = async (req, res, next) => {
    try {
        const COMMON_DRUGS = [
            "Amoxicillin", "Paracetamol", "Ibuprofen", "Omeprazole", "Lisinopril",
            "Metformin", "Amlodipine", "Simvastatin", "Albuterol", "Losartan",
            "Atorvastatin", "Azithromycin", "Ciprofloxacin", "Levothyroxine",
            "Pantoprazole", "Gabapentin", "Amoxicillin/Clavulanate", "Metoprolol",
            "Escitalopram", "Fluoxetine", "Sertraline", "Tramadol", "Clonazepam",
            "Lorazepam", "Cetirizine", "Loratadine", "Fexofenadine", "Fluticasone",
            "Montelukast", "Prednisone", "Meloxicam", "Diclofenac", "Naproxen",
            "Hydrochlorothiazide", "Furosemide", "Spironolactone", "Warfarin",
            "Rivaroxaban", "Apixaban", "Clopidogrel", "Aspirin", "Insulin Glargine",
            "Insulin Lispro", "Glipizide", "Gliclazide", "Sitagliptin", "Empagliflozin",
            "Dapagliflozin", "Rosuvastatin", "Ezetimibe", "Allopurinol", "Colchicine",
            "Methotrexate", "Hydroxychloroquine", "Sulfasalazine", "Adalimumab",
            "Etanercept", "Infliximab", "Rituximab", "Ondansetron", "Metoclopramide",
            "Domperidone", "Prochlorperazine", "Promethazine", "Lactulose", "Senna",
            "Bisacodyl", "Polyethylene Glycol", "Loperamide", "Diphenoxylate/Atropine",
            "Bismuth Subsalicylate", "Dicyclomine", "Hyoscyamine", "Mebeverine",
            "Tamsulosin", "Finasteride", "Dutasteride", "Sildenafil", "Tadalafil",
            "Vardenafil", "Oxybutynin", "Tolterodine", "Solifenacin", "Mirabegron",
            "Levodopa/Carbidopa", "Pramipexole", "Ropinirole", "Rasagiline", "Selegiline",
            "Entacapone", "Donepezil", "Rivastigmine", "Galantamine", "Memantine",
            "Phenytoin", "Carbamazepine", "Valproate", "Lamotrigine", "Levetiracetam",
            "Topiramate"
        ];

        let addedCount = 0;
        
        for (const drugName of COMMON_DRUGS) {
            // Upsert to avoid duplicate key errors if run multiple times
            const result = await drugmodel.updateOne(
                { name: drugName },
                { $setOnInsert: { name: drugName, category: "General" } },
                { upsert: true }
            );
            
            if (result.upsertedCount > 0) addedCount++;
        }

        return successresponse({
            res,
            status: 201,
            message: `Seed completed. ${addedCount} new drugs added to the database.`,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};
