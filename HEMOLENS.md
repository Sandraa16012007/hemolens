TRD 

# **HEMOLENS – TECHNICAL REQUIREMENTS DOCUMENT (TRD)** 

## **Hackathon Version (MVP)** 

# **1. Goal** 

Build a **mobile-responsive AI-powered web application** that enables users to perform a preliminary anemia screening using a smartphone camera. The application estimates anemia risk from an image of the lower eyelid (with an optional nail-bed image), combines it with the user's health profile, and provides personalized AI-generated explanations and guidance. 

**HemoLens is a screening aid only and is not intended to diagnose anemia or replace laboratory blood testing or professional medical advice.** 

# **2. Scope** 

### **Included** 

- User authentication 

- Health profile onboarding 

- Smartphone camera image capture 

- Lower eyelid (conjunctiva) screening 

- Optional nail-bed image capture 

- Smart camera guidance 

- Image quality validation 

- Computer vision preprocessing 

- Machine learning anemia risk prediction 

- Estimated hemoglobin (Hb) range prediction 

- Personalized screening report 

- AI chatbot with contextual memory 

- Screening history 

- Responsive web application 

- Free deployment using open-source technologies 

### **Excluded (Hackathon MVP)** 

- Medical diagnosis 

- Prescription generation 

- Hospital EMR integration 

- Laboratory API integration 

- Wearable device integration 

- Native Android/iOS applications 

- Offline AI inference 

- Multi-language support 

- Voice assistant 

- Appointment booking 

- Payment gateway 

# **3. Target Users** 

- Women and adolescent girls 

- College students 

- Individuals experiencing symptoms of anemia 

- Rural and underserved populations 

- Community health workers (ASHA workers can use the standard application) ● General public interested in preventive health screening 

# **4. Core User Flow** 

Open Web App ↓ 

Sign Up / Login ↓ Complete Health Profile ↓ Capture Lower Eyelid Image (Optional Nail-bed Image) ↓ AI Image Quality Validation ↓ Computer Vision Processing ↓ ML Model Predicts Hb Range & Anemia Risk ↓ Personalized Screening Report ↓ Chat with AI Health Assistant 

↓ If High Risk: Recommend Confirmatory Hb Blood Test 

# **5. Functional Requirements** 

### **FR1 – User Authentication** 

- Users can register and log in securely. 

- User profiles are stored in Supabase. 

### **FR2 – Health Profile Onboarding** 

Collect the following information: 

- Age 

- Gender 

- Height 

- Weight 

- Diet (Vegetarian/Non-vegetarian/Vegan) 

- Previous anemia history 

- Existing medical conditions 

- Current symptoms 

   - Fatigue 

   - Dizziness 

   - Weakness 

   - Pale skin 

   - Shortness of breath 

- Pregnancy status (if applicable) 

This profile is stored and reused for future screenings. 

### **FR3 – Camera Capture** 

Allow users to capture: 

- Lower eyelid (mandatory) 

- Nail-bed image (optional) 

Support both mobile and desktop webcams. 

### **FR4 – Smart Camera Guidance** 

Provide real-time assistance including: 

- Eye positioning guide 

- Image alignment assistance 

- Blur detection 

- Lighting validation 

- Resolution validation 

- Automatic crop suggestion 

- Manual crop option if automatic detection fails 

Reject poor-quality images before prediction. 

### **FR5 – Image Processing** 

Process images using OpenCV: 

- Image normalization 

- Region of Interest (ROI) extraction 

- Color feature extraction 

- Basic preprocessing 

- Feature generation for ML inference 

### **FR6 – ML-Based Screening** 

Predict: 

- Estimated Hemoglobin (Hb) range 

- Anemia risk level: 

   - Normal 

   - Mild 

   - Moderate 

   - Severe 

Display model confidence where applicable. 

### **FR7 – Personalized Screening Report** 

Generate a report containing: 

- Predicted Hb range 

- Risk category 

- Key contributing factors 

- Symptoms considered 

- Health profile summary 

- Recommended next steps 

- Educational disclaimer 

### **FR8 – AI Health Assistant** 

Provide a conversational AI chatbot capable of answering questions such as: 

- What does my result mean? 

- Why am I feeling tired? 

- What foods should I eat? 

- How can I improve my iron intake? 

- When should I get a blood test? 

- What lifestyle changes should I make? 

The chatbot should use: 

- User health profile 

- Previous screening reports 

- Relevant conversation history 

- Trusted medical guidance 

The chatbot must clearly state that it provides educational guidance only and cannot diagnose or prescribe treatment. 

### **FR9 – Screening History** 

Maintain previous screening reports including: 

- Date 

- Estimated Hb 

- Risk level 

- AI-generated summary 

Users can review previous screenings over time. 

# **6. Non-Functional Requirements** 

### **Performance** 

- Screening results generated within **10 seconds** 

- Chatbot response time under **5 seconds** (local model permitting) 

### **Usability** 

- Mobile-first responsive design 

- Simple, accessible interface 

- Minimal onboarding friction 

### **Reliability** 

- Graceful error handling 

- Validation for missing or invalid inputs 

- Stable prediction workflow 

### **Security** 

- Secure user authentication 

- Encrypted communication (HTTPS) 

- User data stored securely in Supabase 

### **Cost** 

- ₹0 deployment cost 

- Free/open-source libraries only 

- No paid AI APIs 

# **7. Technology Stack** 

## **Frontend** 

- React.js 

- Vite 

- Tailwind CSS 

## **Backend** 

- FastAPI (Python) 

## **Computer Vision** 

- OpenCV 

- NumPy 

## **Machine Learning** 

- Scikit-learn 

- Pandas 

- Random Forest / XGBoost (depending on model performance) 

## **AI Health Assistant** 

- Ollama 

- Qwen 3 or Gemma (Local LLM) 

- LangChain 

- ChromaDB (conversation memory) 

## **Database** 

- Supabase PostgreSQL 

## **Authentication** 

- Supabase Auth 

## **Deployment** 

Frontend 

- Vercel 

Backend 

● Render (Free Tier) or Railway 

Version Control 

● GitHub 

# **8. Dataset** 

Preferred public datasets: 

- CP-AnemiC Dataset 

- Eyes Defy Anemia Dataset 

- Other publicly available conjunctival anemia datasets 

If sufficient public data is unavailable, use a curated demonstration dataset with clear disclosure that the MVP is a prototype and not a clinically validated system. 

# **9. Output** 

The system generates: 

- Estimated Hemoglobin (Hb) Range 

- Anemia Risk Level 

- Confidence Score (optional) 

- Contributing Health Factors 

- Personalized AI Explanation 

- Lifestyle Recommendations 

- Recommendation for confirmatory Hb blood testing (when appropriate) 

# **10. AI Health Assistant** 

The chatbot should answer questions related to: 

- Understanding screening results 

- Common anemia symptoms 

- Iron-rich foods 

- Nutrition guidance 

- Lifestyle recommendations 

- Preventive healthcare 

- Importance of laboratory testing 

The chatbot maintains contextual memory using: 

- User onboarding profile 

- Previous screening reports 

- Relevant past conversations 

It must always remind users that laboratory blood testing is required for diagnosis. 

# **11. System Architecture** 

Responsive React Web App 

│ 

▼ User Authentication (Supabase) │ ▼ Health Profile Onboarding │ ▼ Camera Capture │ ▼ Image Quality Validation │ ▼ OpenCV Image Processing │ ▼ 

Feature Extraction │ ▼ 

Machine Learning Model │ ▼ Hb Range + Risk Prediction │ ▼ Personalized Screening Report │ ├──────────────► Screening History (Supabase) │ ▼ 

AI Health Assistant │ ▼ LangChain + ChromaDB Memory │ ▼ Ollama Local LLM 

# **12. Deliverables** 

- Fully functional responsive web application 

- FastAPI backend 

- Trained machine learning model 

- Computer vision preprocessing pipeline 

- AI chatbot with contextual memory 

- Supabase integration 

- Public demo deployment 

- GitHub repository 

- Hackathon presentation 

# **13. Success Criteria** 

The MVP is considered successful if: 

- Users can complete onboarding successfully. 

- Image quality validation works reliably. 

- The ML model generates an anemia risk prediction. 

- A personalized screening report is displayed. 

- The chatbot answers questions using user-specific context. 

- Previous screening history is stored and retrievable. 

- The complete application is deployed using only free services. 

# **14. Future Enhancements** 

- Clinical validation with larger datasets 

- Improved eye segmentation using deep learning 

- Offline AI inference 

- Voice-enabled chatbot 

- Regional language support 

- Medical report upload and analysis 

- Health trend visualization 

- Smart screening reminders 

- Maternal health module 

- Integration with diagnostic laboratories 

- Nearby healthcare provider recommendations 

- Screening for additional nutritional deficiencies (e.g., Vitamin B12, Folate) 

# **Budget** 

#### **Total Development Cost: ₹0 (Hackathon MVP)** 

The project will use only: 

- Free and open-source libraries 

- Free hosting platforms 

- Free database and authentication services 

- Local open-source LLMs via Ollama 

- Publicly available datasets where possible 

No paid APIs, cloud AI services, or proprietary software are required for the MVP. 

PRD 

# **HEMOLENS – PRODUCT REQUIREMENTS DOCUMENT (PRD)** 

## **Hackathon MVP** 

# **Product** 

**HemoLens** is an AI-powered web application that enables users to perform a preliminary anemia screening using a smartphone camera. By combining computer vision, machine learning, and personalized health context, HemoLens estimates anemia risk, explains results through an AI health assistant, and encourages timely confirmatory blood testing. 

# **Product Vision** 

To make preliminary anemia screening accessible, affordable, and personalized by enabling anyone with a smartphone to assess their anemia risk and receive AI-powered health guidance before seeking clinical testing. 

# **Goal** 

Build a responsive web application that: 

- Screens for anemia using a lower eyelid image (primary) and optional nail-bed image. 

- Collects relevant health information during onboarding. 

- Predicts estimated hemoglobin (Hb) range and anemia risk using machine learning. 

- Generates personalized screening reports based on both image analysis and user health context. 

- Provides a context-aware AI health assistant that remembers relevant health information and previous screening results. 

- Encourages high-risk users to undergo confirmatory laboratory blood testing. 

**HemoLens is a screening tool only and does not diagnose anemia or replace professional medical advice.** 

# **Target Users** 

- Women and adolescent girls 

- Individuals experiencing symptoms of anemia 

- College students and young adults 

- Rural and underserved communities 

- Community health workers (using the standard web application) 

- General users interested in preventive healthcare 

# **Problem Statement** 

Anemia is one of the most common nutritional disorders worldwide, yet millions of cases remain undetected due to limited healthcare access, testing costs, and lack of awareness. 

Many people dismiss early symptoms such as fatigue, dizziness, and weakness until the condition becomes more severe. Traditional diagnosis requires laboratory blood testing, which may not always be immediately accessible. 

There is a need for a simple, accessible, and low-cost screening solution that helps users identify potential anemia risk early and guides them toward appropriate medical care. 

# **Scope (Hackathon MVP)** 

## **Core Features** 

### **1. User Authentication** 

- Sign Up 

- Login 

- Secure user accounts using Supabase Authentication 

### **2. Health Profile Onboarding** 

Collect user information including: 

- Age 

- Gender 

- Height 

- Weight 

- Diet 

- Previous anemia history 

- Existing medical conditions 

- Current symptoms 

- Pregnancy status (if applicable) 

This information personalizes all future screenings. 

### **3. Guided Camera Capture** 

Allow users to capture: 

- Lower eyelid image (mandatory) 

- Nail-bed image (optional) 

The interface provides guidance for proper positioning. 

### **4. Smart Image Quality Validation** 

Automatically check for: 

- Poor lighting 

- Blur 

- Improper framing 

- Low image quality 

Prompt users to retake images when necessary. 

### **5. Computer Vision Processing** 

Process captured images to: 

- Detect the region of interest 

- Extract color-related features 

- Prepare images for ML inference 

### **6. AI Anemia Risk Prediction** 

Estimate: 

- Hemoglobin (Hb) range 

- Anemia risk category: 

   - Normal 

   - Mild 

   - Moderate 

   - Severe 

### **7. Personalized Screening Report** 

Display: 

- Estimated Hb range 

- Risk level 

- Key contributing factors 

- Personalized explanation 

- Recommended next steps 

- Educational disclaimer 

### **8. AI Health Assistant** 

Users can ask questions such as: 

- Why am I feeling tired? 

- What foods should I eat? 

- What does my result mean? 

- How can I improve my iron intake? 

- When should I get a blood test? 

The chatbot uses: 

- Health profile 

- Previous screening reports 

- Relevant conversation history 

to provide personalized educational guidance. 

### **9. Screening History** 

Store previous screenings, including: 

- Date 

- Estimated Hb 

- Risk level 

- AI summary 

Users can revisit earlier reports. 

# **User Onboarding Information** 

Collect the following information during onboarding: 

- Age 

- Gender 

- Height 

- Weight 

- Diet 

- Previous anemia history 

- Existing medical conditions 

- Pregnancy status (if applicable) 

- Symptoms 

   - Fatigue 

   - Weakness 

   - Dizziness 

   - Pale skin 

   - Shortness of breath 

# **User Flow** 

Open HemoLens ↓ Sign Up / Login ↓ Complete Health Profile ↓ Capture Lower Eyelid Image (Optional Nail-bed Image) ↓ Image Quality Validation ↓ AI Risk Prediction ↓ Personalized Screening Report ↓ 

Chat with AI Health Assistant 

↓ Recommendation for Blood Test (if required) ↓ Save Screening History 

# **Tech Stack** 

### **Frontend** 

- React.js 

- Vite 

- Tailwind CSS 

### **Backend** 

- FastAPI 

- Supabase 

### **Computer Vision** 

- OpenCV 

### **Machine Learning** 

- Scikit-learn 

- NumPy 

- Pandas 

- Random Forest / XGBoost 

### **AI Chatbot** 

- Ollama 

- Qwen 3 or Gemma 

- LangChain 

- ChromaDB 

### **Deployment** 

- Vercel 

- Render or Railway 

- GitHub 

# **Deliverables** 

- Responsive web application 

- Authentication system 

- Health profile onboarding 

- Camera capture workflow 

- Image quality validation 

- Machine learning inference pipeline 

- Personalized screening reports 

- AI health assistant with contextual memory ● Screening history 

- FastAPI backend 

- Public deployment 

- GitHub repository 

- Demo-ready presentation 

# **Non-Goals (Hackathon MVP)** 

The MVP will **not** include: 

- Medical diagnosis 

- Prescription recommendations 

- Emergency healthcare services 

- Clinical-grade accuracy 

- Hospital information system integration 

- Laboratory report integration 

- Appointment booking 

- Payment systems 

- Native Android/iOS applications 

- Voice assistant 

- Offline AI inference 

- Multi-language support 

# **Success Criteria** 

The project will be considered successful if: 

- Users can complete the entire screening workflow in **under 3 minutes** . 

- Health profile onboarding is completed successfully. 

- The application validates image quality before analysis. 

- The ML model generates an estimated Hb range and anemia risk prediction. 

- Users receive a personalized screening report based on both image analysis and health profile. 

- The AI health assistant provides context-aware responses using previous health information and screening history. 

- Previous screening reports are stored and accessible. 

- The complete application is deployed using only free and open-source technologies. 

- The application clearly communicates that it is a **screening tool** and not a medical diagnostic system. 

# **Future Roadmap** 

- Medical report upload and analysis 

- Long-term health history timeline 

- Personalized screening reminders 

- Maternal health module 

- Regional language support 

- Voice-enabled AI assistant 

- Integration with nearby diagnostic laboratories 

- Healthcare provider referrals 

- Deep learning–based eye segmentation 

- Screening for additional nutritional deficiencies (e.g., Vitamin B12 and Folate) ● Population-level screening dashboards for public health initiatives 

# **Product Positioning** 

**HemoLens** is positioned as an **AI-powered preventive health screening platform** that bridges the gap between symptom awareness and clinical diagnosis. By combining computer vision, machine learning, and conversational AI, it empowers users to identify potential anemia risk early while encouraging timely professional medical evaluation. 

User Flow 

# **HEMOLENS – USER FLOW DOCUMENT** 

## **Hackathon MVP (2 Weeks)** 

**Goal:** Build a responsive AI-powered web application that performs preliminary anemia risk screening (not diagnosis) using smartphone images of the lower eyelid, a personalized health profile, machine learning, and an AI health assistant. 

# **DAY 1** 

### **Landing & Authentication** 

- Splash Screen 

- Sign Up / Login 

- Guest Access (Optional) 

- Consent & Medical Disclaimer 

- Privacy Policy Acceptance 

# **DAY 2** 

### **Health Profile Onboarding** 

Collect user information: 

- Name/Nickname 

- Age 

- Gender 

- Height 

- Weight 

- Diet 

- Pregnancy Status (if applicable) 

- Previous Anemia History 

- Existing Medical Conditions 

- Current Symptoms 

- Save Profile 

# **DAY 3** 

### **Dashboard** 

Display: 

- Start New Screening 

- Previous Screenings 

- AI Health Assistant 

- User Profile 

- Logout 

# **DAY 4** 

### **Smart Camera Guidance** 

Display camera instructions: 

- Position lower eyelid correctly ● Ensure adequate lighting 

- Keep camera steady 

- Show alignment guide 

- Capture Lower Eyelid Image 

- Optional Nail-bed Image 

- Retake Image if Needed 

# **DAY 5** 

### **Image Quality Validation** 

Automatically validate: 

- Lighting 

- Blur 

- Resolution 

- Image framing 

- Eye visibility 

If validation fails: 

- Explain the issue 

- Allow user to retake image 

# **DAY 6** 

### **Image Processing** 

Backend performs: 

- Region of Interest (ROI) detection 

- Image normalization 

- Color feature extraction 

- Feature preprocessing 

- Prepare data for ML inference 

# **DAY 7** 

### **AI Anemia Risk Prediction** 

Machine Learning Model predicts: 

- Estimated Hemoglobin (Hb) Range 

- Risk Category 

   - Normal 

   - Mild 

   - Moderate 

   - Severe 

- Confidence Score (Optional) 

# **DAY 8** 

### **Personalized Screening Report** 

Display: 

- Estimated Hb Range 

- Risk Level 

- Health Profile Summary 

- Factors contributing to prediction 

- Personalized explanation 

- Educational disclaimer 

- Recommendation for confirmatory blood testing (if required) 

# **DAY 9** 

### **AI Health Assistant** 

Users can ask: 

- What does my result mean? 

- Why am I feeling tired? 

- What foods should I eat? 

- How can I improve my iron intake? 

- When should I get tested? 

- How can I reduce my anemia risk? 

The chatbot uses: 

- User health profile 

- Previous screening reports 

- Relevant conversation history 

to provide personalized educational guidance. 

# **DAY 10** 

### **Screening History** 

Store and display: 

- Previous screening dates 

- Estimated Hb ranges 

- Risk levels 

- AI-generated summaries 

Allow users to review previous reports. 

# **DAY 11** 

### **Recommendation Screen** 

For moderate/high-risk users: 

Display: 

- Recommendation to undergo laboratory Hb testing 

- General guidance on consulting a healthcare professional 

- Educational resources on anemia 

_(Nearby laboratory or healthcare referrals can be added in future versions.)_ 

# **DAY 12** 

### **UI & UX Improvements** 

- Responsive design refinement 

- Better spacing and typography 

- Icons and illustrations 

- Loading animations 

- Improved navigation 

- Error handling 

- Empty states 

- Accessibility improvements 

# **DAY 13** 

### **Testing** 

Test complete workflow: 

- Successful onboarding 

- Image capture 

- Image validation 

- ML prediction 

- Screening report generation ● Chatbot responses 

- Screening history 

Test edge cases: 

- Blurry image 

- Dark image 

- Missing onboarding fields 

- Camera permission denied 

- Backend/API failure 

- Invalid inputs 

# **DAY 14** 

### **Demo Flow** 

1. Open HemoLens 

2. Sign Up / Login 

3. Complete Health Profile 

4. Capture Lower Eyelid Image 

5. Optional Nail-bed Image 

6. Image Quality Validation 

7. AI Predicts Hb Range & Anemia Risk 

8. Personalized Screening Report 

9. Ask AI Health Assistant Questions 

10. View Previous Screening History 

11. Receive Recommendation for Confirmatory Blood Test 

# **Out of Scope (Hackathon MVP)** 

- Medical diagnosis 

- Prescription generation 

- Hospital or EMR integration 

- Diagnostic laboratory integration 

- Appointment booking 

- Payment system 

- Native Android/iOS applications 

- Voice assistant 

- Multi-language support 

- Offline AI inference 

- Clinical validation 

- Population health dashboards 

- Government healthcare integration 

# **Final MVP User Flow** 

Open HemoLens ↓ Sign Up / Login ↓ Accept Consent & Disclaimer ↓ Complete Health Profile ↓ Capture Lower Eyelid Image (Optional Nail-bed Image) ↓ Image Quality Validation ↓ OpenCV Image Processing ↓ ML Anemia Risk Prediction ↓ Personalized Screening Report ↓ Chat with AI Health Assistant ↓ Save Screening to History ↓ Recommendation for Confirmatory Blood Test (if applicable) 

# **Primary User Journey** 

User Opens HemoLens ↓ Creates Account ↓ Completes One-Time Health Profile ↓ Starts New Screening ↓ Captures Eye Image ↓ System Validates Image Quality ↓ 

Machine Learning Predicts Hb Range & Risk ↓ Personalized Report is Generated ↓ User Chats with AI Assistant for Guidance ↓ Screening is Saved for Future Reference ↓ User is Encouraged to Seek Laboratory Testing if High Risk 

Implementation Plan 

# **HEMOLENS – IMPLEMENTATION PLAN** 

## **2-Week Hackathon MVP (₹0 Budget)** 

# **Goal** 

Build a fully functional **AI-powered web application** that performs preliminary anemia risk screening using smartphone images, a personalized health profile, machine learning, and a context-aware AI health assistant. 

The objective is to deliver a polished **end-to-end MVP** suitable for a hackathon demonstration, **not a clinically validated medical product** . 

# **Tech Stack (100% Free)** 

### **Frontend** 

- React.js 

- Vite 

- Tailwind CSS 

### **Backend** 

- FastAPI 

- Python 

### **Computer Vision** 

- OpenCV 

- NumPy 

### **Machine Learning** 

- Scikit-learn 

- Pandas 

- Random Forest / XGBoost 

### **AI Health Assistant** 

- Ollama 

- Qwen 3 or Gemma (Local LLM) 

- LangChain ● ChromaDB 

### **Database & Authentication** 

- Supabase PostgreSQL 

- Supabase Auth 

### **Deployment** 

- Vercel 

- Render or Railway 

- GitHub 

# **WEEK 1** 

## **Day 1 — Project Setup & Planning** 

- Finalize MVP scope 

- Create GitHub repositories 

- Setup React + Vite project 

- Setup FastAPI backend 

- Configure Supabase 

- Design UI wireframes 

- Define application architecture 

## **Day 2 — Authentication & Health Profile** 

- Implement Sign Up/Login 

- Create Health Profile onboarding 

- Store user information in Supabase 

- Validate user inputs 

Health Profile includes: 

- Age 

- Gender 

- Height 

- Weight 

- Diet 

- Existing medical conditions 

- Previous anemia history 

- Symptoms 

- Pregnancy status (if applicable) 

## **Day 3 — Camera Capture & Smart Guidance** 

- Implement camera access 

- Capture lower eyelid image 

- Capture optional nail-bed image 

- Build camera overlay guide 

- Add image preview 

- Enable retake functionality 

## **Day 4 — Image Quality Validation & Processing** 

Using OpenCV: 

- Blur detection 

- Brightness validation 

- Resolution checks 

- ROI (Region of Interest) extraction 

- Image normalization 

- Feature extraction 

Reject poor-quality images before prediction. 

## **Day 5 — Machine Learning Model** 

- Prepare public anemia dataset 

- Train ML model 

- Evaluate model performance 

- Export trained model 

- Create prediction API 

Model outputs: 

- Estimated Hb range 

- Risk category 

- Confidence score (optional) 

## **Day 6 — Personalized Screening Report** 

Develop report page showing: 

- Estimated Hb range 

- Anemia risk 

- Contributing health factors 

- Health profile summary 

- Personalized explanation 

- Educational disclaimer 

- Recommendation for laboratory blood testing 

## **Day 7 — Backend Integration** 

Connect: 

- React frontend 

- FastAPI backend 

- ML inference pipeline 

- Supabase database 

Complete the end-to-end screening workflow. 

# **WEEK 2** 

## **Day 8 — AI Health Assistant** 

Integrate: 

- Ollama 

- Qwen 3 or Gemma 

- LangChain 

- ChromaDB 

Enable chatbot memory using: 

- Health profile 

- Previous screening reports 

- Relevant conversation history 

## **Day 9 — Screening History** 

Implement: 

- Save screening reports 

- Display previous screenings 

- View historical summaries 

- Basic report timeline 

## **Day 10 — Report Improvements** 

Enhance report with: 

- Better visualization 

- Health recommendations 

- Lifestyle suggestions 

- Export report (optional if time permits) 

## **Day 11 — Recommendation Module** 

Display recommendations based on risk level: 

- Encourage laboratory Hb testing 

- Educational resources 

- General guidance on consulting healthcare professionals 

_(Nearby healthcare recommendations can be added later if time permits.)_ 

## **Day 12 — UI/UX Polish** 

Improve: 

- Responsive design 

- Icons 

- Typography 

- Loading animations 

- Empty states 

- Error handling 

- Accessibility 

● Overall visual consistency 

## **Day 13 — Testing & Bug Fixing** 

Perform end-to-end testing: 

- Authentication 

- Onboarding 

- Camera workflow 

- Image validation 

- ML prediction 

- Report generation 

- Chatbot 

- Screening history 

Test edge cases: 

- Invalid images 

- Missing inputs 

- Backend failures 

- Camera permission issues 

## **Day 14 — Final Demo Preparation** 

Prepare: 

- Final presentation 

- System architecture diagram ● User flow diagrams 

- Demo script 

- GitHub repository 

- Deployment verification 

- Pitch presentation 

# **Must Have (MVP)** 

- Responsive web application 

- User authentication 

- Health profile onboarding 

- Lower eyelid image capture 

- Optional nail-bed image capture 

- Smart image quality validation 

- OpenCV preprocessing 

- ML-based anemia risk prediction 

- Estimated Hb range 

- Personalized screening report 

- AI Health Assistant 

- Context-aware chatbot memory 

- Screening history 

- Educational disclaimer 

# **Nice to Have** 

- Confidence score visualization 

- Report export (PDF) 

- Health trend visualization 

- Better ROI detection 

- Improved UI animations 

- Additional nutritional recommendations ● Nearby laboratory recommendations 

# **Skip (Hackathon Scope)** 

- Clinical validation 

- Medical diagnosis 

- Prescription generation 

- Hospital EMR integration 

- Laboratory API integration 

- Appointment booking 

- Payment gateway 

- Native Android/iOS applications 

- Voice assistant 

- Multi-language support 

- Offline AI inference 

- Analytics dashboard 

- Government healthcare integration ● Population health reporting 

# **Success Criteria** 

The MVP will be considered successful if: 

1. Users can create an account and complete their health profile. 

2. Users can capture a lower eyelid image (with optional nail-bed image). 

3. The system validates image quality before analysis. 

4. The ML model predicts an estimated Hb range and anemia risk. 

5. A personalized screening report is generated using both image analysis and health profile data. 

6. The AI Health Assistant answers questions using contextual user information and previous screening history. 

7. Screening reports are saved and accessible. 

8. The complete application is deployed using only free services. 

9. The entire workflow can be demonstrated smoothly in **under 5 minutes** . 

# **Demo Walkthrough** 

1. Open HemoLens 

2. Sign Up / Login 

3. Complete Health Profile 

4. Capture Lower Eyelid Image 

5. Optional Nail-bed Image 

6. Image Quality Validation 

7. AI Predicts Hb Range & Anemia Risk 

8. View Personalized Screening Report 

9. Ask Questions to the AI Health Assistant 

10. View Previous Screening History 

11. Receive Recommendation for Confirmatory Blood Testing 

## **Suggested implementation adjustment** 

One recommendation would be to **build the AI chatbot after the end-to-end screening pipeline is complete** . For a hackathon, the core innovation is the screening workflow (camera → CV → ML → report). The chatbot is valuable, but it depends on having meaningful screening results to reference. Prioritizing the screening pipeline first reduces integration risk and ensures you always have a demonstrable MVP, even if chatbot refinement takes longer. 

