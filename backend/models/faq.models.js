import mongoose from "mongoose";

const FaqSchema = new mongoose.Schema({
    question: {
        type: String,
        required: [true, "Question is required"],
        trim: true
    },
    answer: {
        type: String,
        required: [true, "Answer is required"],
        trim: true
    },
    category: {
        type: String,
        default: "General",
        trim: true
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Faq = mongoose.models.Faq || mongoose.model("Faq", FaqSchema);
export default Faq;
