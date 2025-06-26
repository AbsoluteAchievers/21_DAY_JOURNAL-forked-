import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth"; // Removed Auth import as it's no longer needed for type of auth state
import {
  getFirestore,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  Firestore,
} from "firebase/firestore"; // Removed Firestore type from useState directly

// --- Firebase Configuration ---
// Your UNIQUE Firebase Project Configuration
// This tells your app how to connect to YOUR database.
// This is your config from your Firebase Project Settings.
const firebaseConfig = {
  apiKey: "AIzaSyAT4BwbLZtgULUkroyqFHtXmSozLxBzKlI",
  authDomain: "absolute-achievers-journal.firebaseapp.com",
  projectId: "absolute-achievers-journal",
  storageBucket: "absolute-achievers-journal.firebasestorage.app",
  messagingSenderId: "1094601783808",
  appId: "1:1094601783808:web:b4617b73ba7114796ff6e5",
  measurementId: "G-43EFTWQDJE",
};

// Define TypeScript interfaces for your data structures
interface JournalEntry {
  id: string; // Document ID from Firestore
  date: string;
  focusScore: number;
  topPriority: string;
  salesActivityCount: number;
  coreHabitDone: boolean;
  winOfTheDay: string;
  lessonLearned: string;
  createdAt: any; // Firestore Timestamp type, 'any' for simplicity here
}

// Interface for user settings document
interface UserSettings {
  coreHabitDescription?: string; // Optional string property
}

// Main App Component
function App() {
  // Explicitly type useState hooks
  const [db, setDb] = useState<Firestore | null>(null); // Still typing db, but not auth
  // Removed the `auth` state variable entirely as it's not directly used after initialization
  // const [auth, setAuth] = useState<Auth | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Journal entry states - input fields are strings, internal logic converts to number
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [currentDate, setCurrentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [focusScore, setFocusScore] = useState<string>(""); // Value from input type="number" is always string
  const [topPriority, setTopPriority] = useState<string>("");
  const [salesActivityCount, setSalesActivityCount] = useState<string>(""); // Value from input type="number" is always string
  const [coreHabitDone, setCoreHabitDone] = useState<boolean>(false);
  const [winOfTheDay, setWinOfTheDay] = useState<string>("");
  const [lessonLearned, setLessonLearned] = useState<string>("");

  // UI/Feedback states
  const [message, setMessage] = useState<string>("");
  const [showRewardAnimation, setShowRewardAnimation] =
    useState<boolean>(false);

  // Core Habit specific states
  const [challengeCoreHabit, setChallengeCoreHabit] = useState<string>("");
  const [showHabitSetupModal, setShowHabitSetupModal] =
    useState<boolean>(false);
  const [tempCoreHabitInput, setTempCoreHabitInput] = useState<string>("");

  const totalChallengeDays: number = 21;

  // Calculate days completed for the progress bar
  const daysCompleted: number = useMemo(() => {
    const uniqueDates = new Set<string>();
    entries.forEach((entry) => {
      if (
        entry &&
        typeof entry.date === "string" &&
        typeof entry.focusScore === "number" &&
        !isNaN(entry.focusScore)
      ) {
        uniqueDates.add(entry.date.split("T")[0]);
      }
    });
    return Math.min(uniqueDates.size, totalChallengeDays);
  }, [entries, totalChallengeDays]);

  const progressPercentage: number = (daysCompleted / totalChallengeDays) * 100;

  // --- Firebase Initialization and Authentication ---
  useEffect(() => {
    async function initFirebase() {
      try {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authentication = getAuth(app); // Still get auth instance to use it

        setDb(firestore);
        // Removed setAuth(authentication); as 'auth' state is no longer needed

        const unsubscribe = onAuthStateChanged(authentication, async (user) => {
          if (user) {
            setUserId(user.uid);
            console.log("User signed in:", user.uid);
          } else {
            try {
              await signInAnonymously(authentication);
              console.log("Signed in anonymously.");
            } catch (error: any) {
              console.error("Error during anonymous sign-in:", error);
              setMessage("Error signing in. Please try again.");
            }
          }
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (error: any) {
        console.error("Error initializing Firebase:", error);
        setMessage(
          "Failed to initialize application. Please check console for details."
        );
        setIsLoading(false);
      }
    }
    initFirebase();
  }, []);

  // --- Fetch User-Specific Settings (like Core Habit) ---
  useEffect(() => {
    if (db && userId) {
      const userDocRef = doc(db, "users", userId);
      const unsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          const userData = docSnap.data() as UserSettings | undefined;
          if (
            docSnap.exists() &&
            userData &&
            typeof userData.coreHabitDescription === "string"
          ) {
            setChallengeCoreHabit(userData.coreHabitDescription);
          } else {
            setChallengeCoreHabit("");
            if (
              !isLoading &&
              (!userData ||
                typeof userData.coreHabitDescription !== "string") &&
              !showHabitSetupModal
            ) {
              setShowHabitSetupModal(true);
            }
          }
        },
        (error: any) => {
          console.error("Error fetching user settings:", error);
        }
      );
      return () => unsubscribe();
    }
  }, [db, userId, isLoading, showHabitSetupModal]);

  // --- Fetch Journal Entries from Firestore ---
  useEffect(() => {
    if (db && userId) {
      const userJournalPath = `/users/${userId}/journalEntries`;
      const q = query(collection(db, userJournalPath), orderBy("date", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedEntries: JournalEntry[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              date: data.date ? String(data.date) : "",
              focusScore: data.focusScore ? Number(data.focusScore) : 0,
              topPriority: data.topPriority ? String(data.topPriority) : "",
              salesActivityCount: data.salesActivityCount
                ? Number(data.salesActivityCount)
                : 0,
              coreHabitDone:
                typeof data.coreHabitDone === "boolean"
                  ? data.coreHabitDone
                  : false,
              winOfTheDay: data.winOfTheDay ? String(data.winOfTheDay) : "",
              lessonLearned: data.lessonLearned
                ? String(data.lessonLearned)
                : "",
              createdAt: data.createdAt,
            };
          });
          setEntries(fetchedEntries);
          console.log("Fetched entries:", fetchedEntries);
        },
        (error: any) => {
          console.error("Error fetching entries:", error);
          setMessage("Failed to load journal entries. Please try again.");
        }
      );
      return () => unsubscribe();
    }
  }, [db, userId]);

  // --- Handle Setting/Updating Core Habit ---
  const handleSetCoreHabit = async () => {
    if (!db || !userId || !tempCoreHabitInput.trim()) {
      setMessage("Please enter a habit description.");
      return;
    }
    try {
      const userDocRef = doc(db, "users", userId);
      await setDoc(
        userDocRef,
        { coreHabitDescription: tempCoreHabitInput.trim() },
        { merge: true }
      );
      setChallengeCoreHabit(tempCoreHabitInput.trim());
      setShowHabitSetupModal(false);
      setMessage("Your Core Habit has been set!");
    } catch (error: any) {
      console.error("Error setting core habit:", error);
      setMessage("Error setting habit. Please try again.");
    }
  };

  // --- Handle Journal Entry Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!db || !userId) {
      setMessage("Error: Application not ready. Please wait or refresh.");
      return;
    }

    const parsedFocusScore = parseInt(focusScore);
    const parsedSalesActivityCount = parseInt(salesActivityCount);

    if (
      !currentDate ||
      focusScore === "" ||
      !topPriority ||
      salesActivityCount === "" ||
      !winOfTheDay ||
      !lessonLearned
    ) {
      setMessage("Please fill in all required fields.");
      return;
    }
    if (
      isNaN(parsedFocusScore) ||
      parsedFocusScore < 1 ||
      parsedFocusScore > 5
    ) {
      setMessage("Focus Score must be a number between 1 and 5.");
      return;
    }
    if (isNaN(parsedSalesActivityCount) || parsedSalesActivityCount < 0) {
      setMessage("Key Sales Activity Count must be a non-negative number.");
      return;
    }
    if (!challengeCoreHabit) {
      setMessage(
        "Please define your Core Habit before submitting a daily entry!"
      );
      setShowHabitSetupModal(true);
      return;
    }

    try {
      const userJournalPath = `/users/${userId}/journalEntries`;
      await addDoc(collection(db, userJournalPath), {
        date: currentDate,
        focusScore: parsedFocusScore,
        topPriority,
        salesActivityCount: parsedSalesActivityCount,
        coreHabitDone,
        winOfTheDay,
        lessonLearned,
        createdAt: serverTimestamp(),
      });
      setMessage("Journal entry saved successfully!");
      setShowRewardAnimation(true);
      setTimeout(() => setShowRewardAnimation(false), 3000);

      setFocusScore("");
      setTopPriority("");
      setSalesActivityCount("");
      setCoreHabitDone(false);
      setWinOfTheDay("");
      setLessonLearned("");
      setCurrentDate(new Date().toISOString().split("T")[0]);
    } catch (error: any) {
      console.error("Error saving journal entry:", error);
      setMessage("Error saving entry. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
        <div className="text-xl font-semibold text-gray-700">
          Loading Absolute Achievers Journal...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 font-inter text-gray-800 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-blue-200">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mb-4 text-center">
          Absolute Achievers
        </h1>
        <p className="text-xl font-medium text-blue-600 mb-8 text-center">
          Your 21-Day Jumpstart to Elite Performance
        </p>

        {userId && (
          <p className="text-sm text-gray-600 mb-4 text-center select-all">
            Your User ID:{" "}
            <span className="font-mono text-blue-600 break-all">{userId}</span>
          </p>
        )}

        {message && (
          <div
            className={`p-3 mb-4 rounded-lg text-center font-medium ${
              message.includes("Error")
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {message}
          </div>
        )}

        {/* Core Habit Setup Modal */}
        {showHabitSetupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-md text-center border border-blue-300">
              <h2 className="text-2xl font-bold text-blue-800 mb-4">
                Define Your Core Habit
              </h2>
              <p className="text-gray-700 mb-4">
                What is ONE single, consistent habit you commit to for the next
                21 days to boost your performance?
              </p>
              <input
                type="text"
                value={tempCoreHabitInput}
                onChange={(e) => setTempCoreHabitInput(e.target.value)}
                placeholder="e.g., 'Make 10 cold calls before 9 AM'"
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-4"
              />
              <button
                onClick={handleSetCoreHabit}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
              >
                Set My Core Habit
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar for the 21-Day Challenge */}
        <div className="mb-8 p-5 bg-blue-100 rounded-xl shadow-inner border border-blue-200">
          <h2 className="text-xl font-bold text-blue-800 mb-2 text-center">
            Challenge Progress: Day {daysCompleted} of {totalChallengeDays}
          </h2>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-700 text-center">
            You've completed **{Math.round(progressPercentage)}%** of your
            Jumpstart! Keep going!
          </p>
          {daysCompleted >= totalChallengeDays && (
            <p className="mt-2 text-md font-semibold text-green-700 text-center animate-pulse">
              🎉 Congratulations! You've completed your 21-Day Jumpstart! 🎉
              <br />
              Ready for the next level?
            </p>
          )}
        </div>

        {/* Daily Journal Entry Form */}
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl shadow-xl border border-blue-200">
          <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center flex items-center justify-center">
            <span className="mr-2 text-blue-600">✍️</span> Daily Entry
          </h2>
          {challengeCoreHabit ? (
            <p className="text-center text-sm font-medium text-gray-700 mb-4 p-2 bg-blue-200 rounded-lg">
              Your Core Habit for 21 Days: **"{challengeCoreHabit}"**{" "}
              <button
                onClick={() => setShowHabitSetupModal(true)}
                className="ml-2 text-blue-700 hover:text-blue-900 text-xs underline"
              >
                Change
              </button>
            </p>
          ) : (
            <p
              className="text-center text-sm text-red-600 font-medium mb-4 p-2 bg-red-100 rounded-lg cursor-pointer"
              onClick={() => setShowHabitSetupModal(true)}
            >
              Please click here to **define your Core Habit** for the 21-Day
              Jumpstart!
            </p>
          )}
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Date
              </label>
              <input
                type="date"
                id="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                required
              />
            </div>
            <div>
              <label
                htmlFor="focus"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Focus Score (1-5)
              </label>
              <input
                type="number"
                id="focus"
                value={focusScore}
                // Convert to number on change
                onChange={(e) =>
                  setFocusScore(
                    e.target.value === ""
                      ? ""
                      : String(parseInt(e.target.value) || 0)
                  )
                } // Ensure string or number 0
                min="1"
                max="5"
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                placeholder="e.g., 4 (Good Focus)"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="topPriority"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                What I WILL Accomplish Today
              </label>{" "}
              {/* New Label */}
              <textarea
                id="topPriority"
                value={topPriority}
                onChange={(e) => setTopPriority(e.target.value)}
                rows={2}
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                placeholder="Finish proposal for client X, Plan tomorrow's calls."
                required
              ></textarea>
            </div>
            <div>
              <label
                htmlFor="salesActivity"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Key Sales Activity Count
              </label>
              <input
                type="number"
                id="salesActivity"
                value={salesActivityCount}
                // Convert to number on change
                onChange={(e) =>
                  setSalesActivityCount(
                    e.target.value === ""
                      ? ""
                      : String(parseInt(e.target.value) || 0)
                  )
                } // Ensure string or number 0
                min="0"
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                placeholder="e.g., 20 (Calls Made)"
                required
              />
            </div>
            <div className="md:col-span-2 flex items-center mt-2">
              <input
                type="checkbox"
                id="habitDone"
                checked={coreHabitDone}
                onChange={(e) => setCoreHabitDone(e.target.checked)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="habitDone"
                className="ml-3 block text-base font-medium text-gray-700 cursor-pointer"
              >
                Did I do my Core Habit?
              </label>
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="win"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                What I DID Accomplish Today (My Win!)
              </label>{" "}
              {/* New Label */}
              <textarea
                id="win"
                value={winOfTheDay}
                onChange={(e) => setWinOfTheDay(e.target.value)}
                rows={2}
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                placeholder="Successfully handled a tough objection; Closed a small deal!"
                required
              ></textarea>
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="lesson"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Lesson Learned / Insight
              </label>
              <textarea
                id="lesson"
                value={lessonLearned}
                onChange={(e) => setLessonLearned(e.target.value)}
                rows={2}
                className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                placeholder="Focusing on just one priority dramatically improved my efficiency."
                required
              ></textarea>
            </div>

            <div className="md:col-span-2 text-center mt-6">
              <button
                type="submit"
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:scale-105 transition-all duration-200 ease-in-out"
              >
                Save Daily Entry
              </button>
            </div>
          </form>
        </div>

        {/* Reward Animation */}
        {showRewardAnimation && (
          <div className="fixed inset-0 bg-blue-900 bg-opacity-75 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="text-white text-6xl animate-bounce">✨🚀✅</div>
            <p className="absolute text-white text-2xl font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-fade-out-up">
              Success!
            </p>
          </div>
        )}

        {/* Display Past Entries (Enhanced) */}
        <div className="p-6 bg-white rounded-xl shadow-xl border border-gray-200">
          <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center flex items-center justify-center">
            <span className="mr-2 text-blue-600">📚</span> Your Recent Entries
          </h2>
          {entries.length === 0 ? (
            <p className="text-gray-600 text-center italic">
              Start by adding your first daily log above!
            </p>
          ) : (
            <div className="space-y-4">
              {entries.slice(0, totalChallengeDays).map((entry) => (
                <div
                  key={entry.id}
                  className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl shadow-md border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center"
                >
                  <div className="flex-1 mb-2 sm:mb-0">
                    <p className="text-lg font-bold text-blue-700 mb-1">
                      {entry.date}
                    </p>
                    <div className="flex items-center text-sm text-gray-700 mb-1">
                      Focus:{" "}
                      <span
                        className={`ml-1 font-semibold ${
                          entry.focusScore >= 4
                            ? "text-green-600"
                            : entry.focusScore >= 3
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {entry.focusScore}/5
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">
                      Sales Activities:{" "}
                      <span className="font-semibold text-purple-700">
                        {entry.salesActivityCount}
                      </span>
                    </p>
                  </div>
                  <div className="flex-1 sm:text-right">
                    <p className="text-base text-gray-800 font-medium mb-1">
                      Will Accomplish: {entry.topPriority}
                    </p>
                    <p className="text-sm text-gray-700 mb-1">
                      Did Accomplish: {entry.winOfTheDay}
                    </p>
                    <p className="text-sm text-gray-700">
                      Lesson: {entry.lessonLearned}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-2">
                      Core Habit Done:{" "}
                      {entry.coreHabitDone ? "✅ Yes!" : "❌ Not today"}
                    </p>
                  </div>
                </div>
              ))}
              {entries.length > totalChallengeDays && (
                <p className="text-center text-gray-500 text-sm italic mt-4">
                  Showing your most recent {totalChallengeDays} entries. Unlock
                  the full 90-day journal for complete history and advanced
                  insights!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
