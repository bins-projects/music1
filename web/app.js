const SAVE_KEY = "prepflow.savedSession.v1";
const PACK_CATALOG_PATH = "./data/pack-catalog.json";

const hero = document.querySelector(".hero");
const subjects = document.querySelector(".subjects");
const status = document.querySelector("#status");
const homeLauncher = document.querySelector("#home-launcher");
const quizBuilderScreen = document.querySelector("#quiz-builder-screen");
const studyModulesScreen = document.querySelector("#study-modules-screen");
const openQuizBuilderButton = document.querySelector("#open-quiz-builder");
const openStudyModulesButton = document.querySelector("#open-study-modules");
const resumeStudyModulesButton = document.querySelector("#resume-study-modules");
const closeStudyModulesButton = document.querySelector("#close-study-modules");
const studyModulesList = document.querySelector("#study-module-list");
const studyModulesStatus = document.querySelector("#study-modules-status");
const closeQuizBuilderButton = document.querySelector("#close-quiz-builder");
const doneChaptersButton = document.querySelector("#done-chapters");
const quizBuilderOpenBook = document.querySelector("#quiz-builder-openbook");

const resumePanel = document.querySelector("#resume-panel");
const resumeDescription = document.querySelector("#resume-description");
const resumeSessionButton = document.querySelector("#resume-session");
const discardSessionButton = document.querySelector("#discard-session");

const chapterScreen = document.querySelector("#chapter-screen");
const chapterTitle = document.querySelector("#chapter-title");
const chapterList = document.querySelector("#chapter-list");
const chapterPreviousButton = document.querySelector("#chapter-previous");
const chapterNextButton = document.querySelector("#chapter-next");
const chapterPageNumbers = document.querySelector("#chapter-page-numbers");
const selectionCount = document.querySelector("#selection-count");
const selectedChapterSummary = document.querySelector("#selected-chapter-summary");
const selectedQuestionSummary = document.querySelector("#selected-question-summary");
const selectedChapterNumbers = document.querySelector("#selected-chapter-numbers");
const startButton = document.querySelector("#start-button");
const blockSizeSelect = document.querySelector("#block-size");

const quizBuilder = document.querySelector("#quiz-builder");
const builderSelectionCount = document.querySelector("#builder-selection-count");
const builderBookCount = document.querySelector("#builder-book-count");
const globalBlockSizeSelect = document.querySelector("#global-block-size");
const shuffleQuestionsToggle = document.querySelector("#shuffle-questions");
const clearSelectionsButton = document.querySelector("#clear-selections");
const buildQuizButton = document.querySelector("#build-quiz");

const quizScreen = document.querySelector("#quiz-screen");
const quizSubject = document.querySelector("#quiz-subject");
const quizPosition = document.querySelector("#quiz-position");
const quizQuestionId = document.querySelector("#quiz-question-id");
const copyQuestionIdButton = document.querySelector("#copy-question-id");
const copyQuestionReportButton = document.querySelector("#copy-question-report");
const skipQuestionButton = document.querySelector("#skip-question");
const questionCopyStatus = document.querySelector("#question-copy-status");
const quizProgress = document.querySelector("#quiz-progress");
const questionStem = document.querySelector("#question-stem");
const answerChoices = document.querySelector("#answer-choices");
const responsePageLabel = document.querySelector("#response-page-label");
const feedback = document.querySelector("#feedback");
const feedbackResult = document.querySelector("#feedback-result");
const feedbackRationale = document.querySelector("#feedback-rationale");
const quizScore = document.querySelector("#quiz-score");
const submitAnswer = document.querySelector("#submit-answer");
const continueButton = document.querySelector("#continue-button");

const blockSummary = document.querySelector("#block-summary");
const summaryTitle = document.querySelector("#summary-title");
const summaryScore = document.querySelector("#summary-score");
const summaryMessage = document.querySelector("#summary-message");
const summaryAction = document.querySelector("#summary-action");
const summaryExit = document.querySelector("#summary-exit");

let currentSubject = null;
let currentPack = null;
let currentPackPath = null;

const loadedPacks = new Map();
const selectedChapters = new Map();
let packCatalog = [];
let packCatalogPromise = null;
let studyModules = [];
let studyModulesPromise = null;

let sessionQuestions = [];
let sessionBlockSize = 15;
let sessionShuffleQuestions = true;

let currentChapterEntries = [];
let currentChapterSpread = 0;
let chaptersPerSpread = 10;
let chapterRowsPerPage = 5;

function chapterSpreadLayout(theme) {
  const layouts = {
    "med-surg": { chaptersPerSpread: 12, rowsPerPage: 6 },
    fundamentals: { chaptersPerSpread: 12, rowsPerPage: 6 },
    pediatrics: { chaptersPerSpread: 10, rowsPerPage: 5 },
    pharm: { chaptersPerSpread: 8, rowsPerPage: 4 },
  };

  return layouts[theme] || {
    chaptersPerSpread: 10,
    rowsPerPage: 5,
  };
}

let blockStart = 0;
let blockEnd = 0;
let questionIndex = 0;
let blockNumber = 1;

let firstPassCorrect = 0;
let firstPassMissed = 0;
let firstPassSkipped = 0;
let blockCorrect = 0;
let blockSkipped = 0;
let blockMissed = [];

let reviewQueue = [];
let reviewMode = false;
let currentReviewQuestion = null;
let questionSubmissionState = "idle";

function readSavedSession() {
  const raw = localStorage.getItem(SAVE_KEY);
  const result = PrepFlowSavedSessionRules.parseSavedSession(raw, 3);

  if (result.shouldClear) {
    localStorage.removeItem(SAVE_KEY);
  }

  return result.saved;
}

function clearSavedSession() {
  localStorage.removeItem(SAVE_KEY);
  refreshResumePanel();
}

function saveSession(screen) {
  if (sessionQuestions.length === 0) {
    return;
  }

  const state = {
    version: 3,
    savedAt: new Date().toISOString(),
    screen,
    currentSubject,
    sessionQuestions,
    sessionBlockSize,
    sessionShuffleQuestions,
    blockStart,
    blockEnd,
    questionIndex,
    blockNumber,
    firstPassCorrect,
    firstPassMissed,
    firstPassSkipped,
    blockCorrect,
    blockSkipped,
    blockMissed,
    reviewQueue,
    reviewMode,
    currentReviewQuestion,
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function refreshResumePanel() {
  const saved = readSavedSession();
  const hasSavedSession = Boolean(saved);

  quizBuilder.hidden = hasSavedSession;
  resumePanel.hidden = !hasSavedSession;

  if (!saved) {
    resumeDescription.textContent = "";
    return;
  }

  const description = PrepFlowResumeRules.resumeDescription(saved);

  resumeDescription.textContent = description;
  resumeSessionButton.title = description;
  resumeSessionButton.setAttribute(
    "aria-label",
    PrepFlowResumeRules.resumeAriaLabel(description)
  );
}

function hideAllScreens() {
  hero.hidden = true;
  subjects.hidden = true;
  homeLauncher.hidden = true;
  quizBuilderScreen.hidden = true;
  studyModulesScreen.hidden = true;
  quizBuilder.hidden = true;
  resumePanel.hidden = true;
  chapterScreen.hidden = true;
  quizScreen.hidden = true;
  blockSummary.hidden = true;
  status.hidden = true;
}

function updateSelectionStatus() {
  const totalSelected = selectedChapters.size;

  const allSelections = [...selectedChapters.values()];
  const currentBookSelections = allSelections.filter(
    (selection) => selection.packPath === currentPackPath
  );

  const currentBookSelected = currentBookSelections.length;

  const totalSelectedQuestions = allSelections.reduce(
    (total, selection) => total + (selection.questionCount || 0),
    0
  );

  const totalChapterSelectionText =
    PrepFlowSelectionRules.chapterSelectionText(totalSelected);

  const currentBookChapterSelectionText =
    PrepFlowSelectionRules.chapterSelectionText(currentBookSelected);

  const currentBookQuestions = currentBookSelections.reduce(
    (total, selection) => total + (selection.questionCount || 0),
    0
  );

  selectionCount.textContent = currentBookChapterSelectionText;
  selectedChapterSummary.textContent =
    currentBookChapterSelectionText;
  selectedQuestionSummary.textContent =
    `${currentBookQuestions.toLocaleString()} ${
      currentBookQuestions === 1 ? "question" : "questions"
    } selected`;

  const currentBookChapterNumbers = currentBookSelections
    .map((selection) => String(selection.chapterKey).split("|", 1)[0])
    .filter(Boolean);

  const visibleChapterNumbers = currentBookChapterNumbers.slice(0, 5);
  const remainingChapterCount =
    currentBookChapterNumbers.length - visibleChapterNumbers.length;

  selectedChapterNumbers.textContent =
    visibleChapterNumbers.length === 0
      ? "Selected: none"
      : `Selected: ${visibleChapterNumbers.join(", ")}${
          remainingChapterCount > 0
            ? ` +${remainingChapterCount} more`
            : ""
        }`;

  builderSelectionCount.textContent =
    totalChapterSelectionText;
  builderBookCount.textContent =
    totalSelected === 0
      ? "Open a book to choose chapters"
      : `${totalSelectedQuestions.toLocaleString()} ${
          totalSelectedQuestions === 1 ? "question" : "questions"
        } total`;

  startButton.disabled = totalSelected === 0;
  buildQuizButton.disabled = totalSelected === 0;
  clearSelectionsButton.disabled = totalSelected === 0;

  document.querySelectorAll(".subject-card").forEach((book) => {
    const packPath = book.dataset.pack;
    const count = [...selectedChapters.values()].filter(
      (selection) => selection.packPath === packPath
    ).length;

    let badge = book.querySelector(".book-selected-count");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "book-selected-count";
      book.append(badge);
    }

    badge.textContent = count > 0 ? PrepFlowSelectionRules.bookBadgeText(count) : "";

    book.classList.toggle("has-selections", count > 0);
  });
}

function showSubjects() {
  document.body.classList.remove(
    "book-open",
    "real-book-chapters"
  );
  hideAllScreens();

  hero.hidden = false;
  homeLauncher.hidden = false;
  status.hidden = true;

  const selected = selectedChapters.size;
  status.textContent = PrepFlowSelectionRules.homeStatusText(selected);

  refreshResumePanel();
}

function showQuizBuilder() {
  document.body.classList.remove(
    "book-open",
    "real-book-chapters"
  );
  document.body.classList.add("builder-open");

  hideAllScreens();

  quizBuilderScreen.hidden = false;
  subjects.hidden = false;

  updateSelectionStatus();
}

async function loadStudyModules() {
  if (studyModulesPromise) return studyModulesPromise;

  studyModulesPromise = fetch("./data/study-modules.json")
    .then((response) => {
      if (!response.ok) throw new Error("Could not load study modules.");
      return response.json();
    })
    .then((catalog) => {
      if (catalog.format !== "prepflow_study_module_catalog" || !Array.isArray(catalog.modules)) {
        throw new Error("The study-module catalog has an unsupported format.");
      }
      studyModules = catalog.modules;
      return studyModules;
    })
    .catch((error) => {
      studyModulesPromise = null;
      throw error;
    });

  return studyModulesPromise;
}

function renderStudyModules(modules) {
  studyModulesList.replaceChildren();

  modules.forEach((module) => {
    const card = document.createElement("article");
    card.className = "study-module-card";

    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = module.title;
    const description = document.createElement("p");
    description.textContent = module.description;
    const count = document.createElement("small");
    count.textContent = module.question_count.toLocaleString() + " questions";
    details.append(title, description, count);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "study-module-start";
    button.dataset.studyModuleId = module.id;
    button.textContent = "Start Study";

    card.append(details, button);
    studyModulesList.append(card);
  });
}

async function showStudyModules() {
  document.body.classList.remove("builder-open", "book-open", "real-book-chapters");
  hideAllScreens();
  studyModulesScreen.hidden = false;
  studyModulesStatus.hidden = true;

  try {
    renderStudyModules(await loadStudyModules());
  } catch (error) {
    studyModulesStatus.textContent = error.message;
    studyModulesStatus.hidden = false;
  }
}

function bookButton(book) {
  const button = document.createElement("button");
  const themed = Boolean(book.art);
  button.className = `subject-card ${themed ? book.theme || "" : "generic-book"}`.trim();
  button.dataset.subject = book.title;
  button.dataset.pack = book.path;
  button.dataset.theme = book.theme || "generic";
  button.setAttribute(
    "aria-label",
    `Open ${book.title} — ${book.question_count.toLocaleString()} questions in ${book.chapter_count} chapters`
  );
  if (themed) {
    const image = document.createElement("img");
    image.className = "approved-book-art";
    image.src = book.art;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    button.append(image);
    const hidden = document.createElement("span");
    hidden.className = "sr-only";
    hidden.textContent = `${book.title} — ${book.question_count.toLocaleString()} questions. Choose chapters.`;
    button.append(hidden);
  } else {
    const title = document.createElement("span");
    title.className = "generic-book-title";
    title.textContent = book.title;
    const meta = document.createElement("span");
    meta.className = "generic-book-meta";
    meta.textContent = `${book.chapter_count} chapters · ${book.question_count.toLocaleString()} questions`;
    const action = document.createElement("span");
    action.className = "generic-book-action";
    action.textContent = "Choose chapters →";
    button.append(title, meta, action);
  }
  button.addEventListener("click", () => launchBook(button));
  return button;
}

function renderBookCatalog(catalog) {
  packCatalog = catalog.books;
  subjects.replaceChildren(...packCatalog.map(bookButton));
  document.dispatchEvent(new CustomEvent("prepflow:catalog-ready"));
  updateSelectionStatus();
}

async function loadBookCatalog() {
  if (packCatalogPromise) return packCatalogPromise;
  packCatalogPromise = fetch(PACK_CATALOG_PATH)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load the book catalog: ${response.status}`);
      return response.json();
    })
    .then((catalog) => {
      if (catalog?.format !== "prepflow_pack_catalog" || !Array.isArray(catalog.books)) {
        throw new Error("The book catalog is invalid.");
      }
      renderBookCatalog(catalog);
      return catalog;
    })
    .catch((error) => {
      status.hidden = false;
      status.textContent = error.message;
      throw error;
    });
  return packCatalogPromise;
}

async function loadPack(packPath) {
  if (loadedPacks.has(packPath)) {
    return loadedPacks.get(packPath);
  }

  const response = await fetch(packPath);

  if (!response.ok) {
    throw new Error(`Could not load study category: ${response.status}`);
  }

  const pack = await response.json();
  loadedPacks.set(packPath, pack);
  return pack;
}

function renderChapterSpread() {
  const totalSpreads = Math.max(
    1,
    Math.ceil(currentChapterEntries.length / chaptersPerSpread)
  );

  currentChapterSpread = Math.min(
    Math.max(currentChapterSpread, 0),
    totalSpreads - 1
  );

  const startIndex = currentChapterSpread * chaptersPerSpread;
  const visibleChapters = currentChapterEntries.slice(
    startIndex,
    startIndex + chaptersPerSpread
  );

  chapterList.replaceChildren();

  visibleChapters.forEach(({ key, chapter }) => {
    const label = document.createElement("label");
    label.className = "chapter-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = key;
    checkbox.dataset.questionCount = chapter.count;

    const selectionKey = `${currentPackPath}|${key}`;
    checkbox.checked = selectedChapters.has(selectionKey);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedChapters.set(selectionKey, {
          packPath: currentPackPath,
          subject: currentSubject,
          chapterKey: key,
          questionCount: chapter.count,
        });
      } else {
        selectedChapters.delete(selectionKey);
      }

      updateSelectionStatus();
    });

    const text = document.createElement("span");
    text.className = "chapter-option-text";

    const name = document.createElement("span");
    name.className = "chapter-name";
    name.textContent = `Chapter ${chapter.number}: ${chapter.title}`;

    const count = document.createElement("span");
    count.className = "chapter-count";
    count.textContent = `${chapter.count.toLocaleString()} questions`;

    text.append(name, count);
    label.append(checkbox, text);
    chapterList.append(label);
  });

  const leftPageNumbers = document.createElement("div");
  leftPageNumbers.className =
    "chapter-page-number-group chapter-page-number-group-left";

  const rightPageNumbers = document.createElement("div");
  rightPageNumbers.className =
    "chapter-page-number-group chapter-page-number-group-right";

  const splitIndex = Math.ceil(totalSpreads / 2);

  for (let index = 0; index < totalSpreads; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-page-number";
    button.textContent = String(index + 1);
    button.dataset.chapterSpread = String(index);
    button.setAttribute(
      "aria-label",
      `Show chapter spread ${index + 1} of ${totalSpreads}`
    );

    if (index === currentChapterSpread) {
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    if (index < splitIndex) {
      leftPageNumbers.append(button);
    } else {
      rightPageNumbers.append(button);
    }
  }

  chapterPageNumbers.replaceChildren(
    leftPageNumbers,
    rightPageNumbers
  );

  chapterPreviousButton.hidden = currentChapterSpread === 0;
  chapterNextButton.hidden = currentChapterSpread >= totalSpreads - 1;

  chapterPreviousButton.setAttribute(
    "aria-label",
    `Previous chapter spread`
  );
  chapterNextButton.setAttribute(
    "aria-label",
    `Next chapter spread`
  );

  chapterList.scrollTop = 0;
}

function showChapterSpread(index) {
  if (!Number.isInteger(index)) {
    return;
  }

  currentChapterSpread = index;
  renderChapterSpread();
}

async function showChapters(button) {
  status.textContent = "Loading chapters…";

  try {
    currentPackPath = button.dataset.pack;
    currentPack = await loadPack(currentPackPath);
    currentSubject = button.dataset.subject;

    const chapters = new Map();

    currentPack.questions.forEach((question) => {
      const key = `${question.chapter}|${question.chapter_title}`;
      const existing = chapters.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        chapters.set(key, {
          number: question.chapter,
          title: question.chapter_title || "Untitled Chapter",
          count: 1,
        });
      }
    });

    currentChapterEntries = [...chapters.entries()].map(
      ([key, chapter]) => ({ key, chapter })
    );

    const spreadLayout = chapterSpreadLayout(
      button.dataset.theme || "generic"
    );
    chaptersPerSpread = spreadLayout.chaptersPerSpread;
    chapterRowsPerPage = spreadLayout.rowsPerPage;
    currentChapterSpread = 0;

    chapterScreen.style.setProperty(
      "--chapter-rows-per-page",
      String(chapterRowsPerPage)
    );

    chapterTitle.textContent =
      button.dataset.theme === "med-surg"
        ? "Med-Surg"
        : currentSubject;
    chapterScreen.dataset.theme = button.dataset.theme || "generic";

    const usesRealOpenBook = true;

    chapterScreen.hidden = false;

    if (usesRealOpenBook) {
      /*
        Keep the approved nursing-station scene visible beneath the real
        open-book chapter interface.
      */
      quizBuilderScreen.hidden = false;
      document.body.classList.add(
        "builder-open",
        "book-open",
        "real-book-chapters"
      );
    } else {
      quizBuilderScreen.hidden = true;
      document.body.classList.remove(
        "builder-open",
        "real-book-chapters"
      );
      document.body.classList.add("book-open");
    }

    status.hidden = true;

    renderChapterSpread();
    updateSelectionStatus();
  } catch (error) {
    status.hidden = false;
    status.textContent = error.message;
  }
}

function currentQuestionReference() {
  return reviewMode ? currentReviewQuestion : sessionQuestions[questionIndex];
}

function currentQuestion() {
  const reference = currentQuestionReference();
  const pack = loadedPacks.get(reference.packPath);

  if (!pack) {
    throw new Error(`Study category is not loaded: ${reference.packPath}`);
  }

  const question = pack.questions.find(
    (candidate) => candidate.id === reference.questionId
  );

  if (!question) {
    throw new Error(
      `Question is not available: ${reference.questionId}`
    );
  }

  return question;
}

function currentQuestionPack() {
  return loadedPacks.get(currentQuestionReference().packPath);
}

function displayQuestionReference(packTitle, questionId) {
  return PrepFlowQuestionReferenceRules.stableReference(
    packTitle,
    questionId
  ).concise;
}

function currentQuizSessionPosition() {
  const reference = currentQuestionReference();
  const originalIndex = reviewMode
    ? sessionQuestions.findIndex(
        (candidate) => candidate.packPath === reference.packPath
          && candidate.questionId === reference.questionId
      )
    : questionIndex;
  const position = originalIndex >= 0 ? originalIndex + 1 : questionIndex + 1;
  return `Question ${position} of ${sessionQuestions.length}${reviewMode ? " (redo misses)" : ""}`;
}

async function copyTextLocally(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) throw new Error("Clipboard access is unavailable.");
}

function showCopyStatus(message) {
  questionCopyStatus.textContent = message;
  window.setTimeout(() => {
    if (questionCopyStatus.textContent === message) questionCopyStatus.textContent = "";
  }, 2500);
}

async function copyCurrentQuestionId() {
  const question = currentQuestion();
  const reference = PrepFlowQuestionReferenceRules.stableReference(
    currentQuestionPack()?.title,
    question.id
  );
  if (!reference.available) return;
  await copyTextLocally(reference.fullId);
  showCopyStatus("Copied full PFQ ID.");
}

async function copyCurrentQuestionReport() {
  const question = currentQuestion();
  const packTitle = currentQuestionPack()?.title || "Pack";
  const report = PrepFlowQuestionReferenceRules.reportText({
    packTitle,
    question,
    progress: currentQuizSessionPosition(),
  });
  await copyTextLocally(report);
  showCopyStatus("Copied question report.");
}

function totalBlockCount() {
  return PrepFlowSessionRules.totalBlockCount(
    sessionQuestions.length,
    sessionBlockSize
  );
}

function showQuestion() {
  const question = currentQuestion();
  const questionPack = currentQuestionPack();
  const stableReference = PrepFlowQuestionReferenceRules.stableReference(
    questionPack?.title,
    question.id
  );
  const questionKind = PrepFlowQuizRules.questionKind(question);
  const isMultipleResponse = PrepFlowQuizRules.isMultipleResponseQuestion(question);
  const blockLength = blockEnd - blockStart;

  questionSubmissionState = "idle";

  hideAllScreens();
  quizScreen.hidden = false;

  quizSubject.textContent = questionPack?.title || "";
  quizQuestionId.textContent = displayQuestionReference(questionPack?.title, question.id);
  quizQuestionId.title = stableReference.available ? stableReference.fullId : "";
  if (copyQuestionIdButton) {
    copyQuestionIdButton.disabled = !stableReference.available;
    copyQuestionIdButton.title = stableReference.available ? `Copy ${stableReference.fullId}` : "Reference unavailable";
  }
  if (copyQuestionReportButton) {
    copyQuestionReportButton.disabled = false;
  }
  skipQuestionButton.disabled = false;
  questionCopyStatus.textContent = "";

  if (reviewMode) {
    quizPosition.textContent = PrepFlowDisplayRules.quizPositionText({
      blockNumber,
      totalBlocks: totalBlockCount(),
      reviewMode: true,
      reviewRemaining: reviewQueue.length + 1,
      questionInBlock: null,
      blockLength,
    });

    quizProgress.max = Math.max(reviewQueue.length + 1, 1);
    quizProgress.value = 1;
  } else {
    const questionInBlock = PrepFlowSessionRules.questionPosition(
      questionIndex,
      blockStart
    );

    quizPosition.textContent = PrepFlowDisplayRules.quizPositionText({
      blockNumber,
      totalBlocks: totalBlockCount(),
      reviewMode: false,
      reviewRemaining: null,
      questionInBlock,
      blockLength,
    });

    quizProgress.max = blockLength;
    quizProgress.value = questionInBlock;
  }

  questionStem.textContent = question.stem;
  responsePageLabel.textContent = questionKind === "text"
    ? "Enter Your Answer"
    : questionKind === "ordered"
      ? "Put in Order"
      : isMultipleResponse ? "Select All That Apply" : "Choose Your Answer";
  answerChoices.hidden = false;
  answerChoices.replaceChildren();

  if (questionKind === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = "answer-text";
    input.className = "completion-answer";
    input.autocomplete = "off";
    input.placeholder = "Type your answer";
    input.addEventListener("input", () => { submitAnswer.disabled = !input.value.trim(); });
    answerChoices.append(input);
  } else if (questionKind === "ordered") {
    const ordered = question.choices.map((choice) => ({ ...choice }));
    const renderOrdered = () => {
      answerChoices.replaceChildren();
      ordered.forEach((choice, index) => {
        const row = document.createElement("div");
        row.className = "answer-choice ordered-answer";
        row.dataset.label = choice.label;
        const text = document.createElement("span");
        text.textContent = `${choice.label}. ${choice.text}`;
        const up = document.createElement("button");
        const down = document.createElement("button");
        up.type = down.type = "button";
        up.className = down.className = "secondary-button ordered-move";
        up.textContent = "Move up"; down.textContent = "Move down";
        up.disabled = index === 0; down.disabled = index === ordered.length - 1;
        up.addEventListener("click", () => { [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]]; renderOrdered(); });
        down.addEventListener("click", () => { [ordered[index + 1], ordered[index]] = [ordered[index], ordered[index + 1]]; renderOrdered(); });
        row.append(text, up, down); answerChoices.append(row);
      });
      submitAnswer.disabled = ordered.length === 0;
    };
    renderOrdered();
  } else {
    question.choices.forEach((choice) => {
      const label = document.createElement("label");
      label.className = "answer-choice";
      const input = document.createElement("input");
      input.type = isMultipleResponse ? "checkbox" : "radio";
      input.name = "answer";
      input.value = choice.label;
      input.addEventListener("change", () => {
        submitAnswer.disabled = answerChoices.querySelectorAll('input[name="answer"]:checked').length === 0;
      });
      const text = document.createElement("span");
      text.textContent = `${choice.label}. ${choice.text}`;
      label.append(input, text); answerChoices.append(label);
    });
  }

  feedback.hidden = true;
  submitAnswer.hidden = false;
  submitAnswer.disabled = true;
  continueButton.hidden = true;

  quizScore.textContent = PrepFlowDisplayRules.runningScoreText(
    firstPassCorrect,
    firstPassMissed
  );

  saveSession("question");

  document.dispatchEvent(new CustomEvent("prepflow:question-shown", {
    detail: {
      questionType: question.type || question.question_type,
      packPath: currentQuestionReference().packPath,
    },
  }));
}

function beginBlock() {
  blockEnd = PrepFlowSessionRules.blockEnd(
    blockStart,
    sessionBlockSize,
    sessionQuestions.length
  );

  questionIndex = blockStart;
  blockCorrect = 0;
  blockSkipped = 0;
  blockMissed = [];
  reviewQueue = [];
  reviewMode = false;
  currentReviewQuestion = null;

  showQuestion();
}

function showFinalSummary() {
  hideAllScreens();
  blockSummary.hidden = false;
  blockSummary.dataset.summaryState = "final";

  const totalQuestions = sessionQuestions.length;
  const percentage = PrepFlowSessionRules.firstPassPercentage(
    firstPassCorrect,
    totalQuestions
  );

  summaryTitle.textContent = "Quiz Complete";
  summaryScore.textContent = PrepFlowDisplayRules.finalScoreText(percentage);
  summaryMessage.textContent = PrepFlowDisplayRules.finalMessage(
    firstPassCorrect,
    totalQuestions
  );

  summaryAction.textContent = "Return Home";
  summaryAction.dataset.action = "return-home";
  summaryExit.hidden = true;

  clearSavedSession();
}

function appendProgressStat(container, label, value) {
  const statistic = document.createElement("section");
  statistic.className = "block-progress-stat";

  const statisticLabel = document.createElement("span");
  statisticLabel.className = "block-progress-stat-label";
  statisticLabel.textContent = label;

  const statisticValue = document.createElement("strong");
  statisticValue.textContent = value;

  statistic.append(statisticLabel, statisticValue);
  container.append(statistic);
}

function questionCountText(count) {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

function renderMobileBlockProgress(blockLength) {
  const cumulativeCompleted = blockEnd;
  const totalQuestions = sessionQuestions.length;
  const nextBlockEnd = PrepFlowSessionRules.blockEnd(
    blockEnd,
    sessionBlockSize,
    totalQuestions
  );
  const nextBlockLength = nextBlockEnd - blockEnd;
  const blockScoredTotal = Math.max(0, blockLength - blockSkipped);
  const cumulativeScoredTotal = Math.max(
    0,
    cumulativeCompleted - firstPassSkipped
  );
  const blockPercentage = PrepFlowSessionRules.firstPassPercentage(
    blockCorrect,
    blockScoredTotal
  );
  const cumulativePercentage = PrepFlowSessionRules.firstPassPercentage(
    firstPassCorrect,
    cumulativeScoredTotal
  );
  const overallPercentage = PrepFlowSessionRules.firstPassPercentage(
    cumulativeCompleted,
    totalQuestions
  );
  const missedCount = blockMissed.length;

  summaryScore.replaceChildren();
  summaryMessage.replaceChildren();

  appendProgressStat(
    summaryMessage,
    "Block first-attempt score",
    `${blockCorrect} of ${blockScoredTotal} correct (${blockPercentage}%)`
  );
  appendProgressStat(
    summaryMessage,
    "Cumulative first-attempt score",
    `${firstPassCorrect} of ${cumulativeScoredTotal} correct (${cumulativePercentage}%)`
  );
  appendProgressStat(
    summaryMessage,
    "Review complete",
    missedCount === 1
      ? "1 missed question mastered"
      : `${missedCount} missed questions mastered`
  );

  const overall = document.createElement("section");
  overall.className = "block-progress-stat block-progress-overall";
  const overallLabel = document.createElement("span");
  overallLabel.className = "block-progress-stat-label";
  overallLabel.textContent = "Overall quiz progress";
  const overallValue = document.createElement("strong");
  overallValue.textContent =
    `${cumulativeCompleted} of ${totalQuestions} questions (${overallPercentage}%)`;
  const progress = document.createElement("progress");
  progress.max = Math.max(totalQuestions, 1);
  progress.value = cumulativeCompleted;
  progress.setAttribute(
    "aria-label",
    `Overall quiz progress: ${cumulativeCompleted} of ${totalQuestions} questions complete`
  );
  overall.append(overallLabel, overallValue, progress);
  summaryMessage.append(overall);

  appendProgressStat(
    summaryMessage,
    "Up next",
    `Block ${blockNumber + 1}: ${questionCountText(nextBlockLength)}`
  );
}

function showBlockSummary(mastered = false) {
  summaryExit.hidden = false;
  hideAllScreens();
  blockSummary.hidden = false;

  const blockLength = blockEnd - blockStart;
  const missedCount = blockMissed.length;
  const hasMoreQuestions = blockEnd < sessionQuestions.length;
  const showsMobileBlockProgress =
    mastered
    && hasMoreQuestions
    && usesMobilePortraitPresentation();

  blockSummary.dataset.summaryState = showsMobileBlockProgress
    ? "block-progress"
    : "block-summary";

  if (showsMobileBlockProgress) {
    summaryTitle.textContent = `Block ${blockNumber} Complete`;
    renderMobileBlockProgress(blockLength);
    summaryAction.textContent = "Continue to Next Block";
    summaryAction.dataset.action = "next-block";
    summaryAction.dataset.blockEnd = String(blockEnd);
    summaryExit.textContent = "Save & Quit";
    saveSession("block-progress");
    return;
  }

  summaryTitle.textContent = PrepFlowDisplayRules.blockTitle(
    blockNumber,
    mastered
  );
  summaryScore.textContent = PrepFlowDisplayRules.firstPassBlockScoreText(
    blockCorrect,
    Math.max(0, blockLength - blockSkipped)
  );
  summaryMessage.textContent = PrepFlowDisplayRules.blockMessage(
    missedCount,
    mastered
  );

  const nextAction = PrepFlowSummaryRules.summaryAction({
    mastered,
    missedCount,
    hasMoreQuestions,
  });

  summaryAction.textContent = nextAction.label;
  summaryAction.dataset.action = nextAction.action;
  summaryAction.dataset.blockEnd = String(blockEnd);
  summaryExit.textContent = "Exit Session";

  saveSession(mastered ? "mastered-summary" : "block-summary");
}

function startReview() {
  reviewMode = true;
  reviewQueue = [...blockMissed];
  currentReviewQuestion = reviewQueue.shift();
  showQuestion();
}

function advanceToNextBlock(completedBlockEnd = blockEnd) {
  const boundary = Number(completedBlockEnd);

  if (
    !Number.isFinite(boundary)
    || boundary !== blockEnd
    || blockStart >= boundary
  ) {
    return;
  }

  if (boundary >= sessionQuestions.length) {
    showFinalSummary();
    return;
  }

  blockStart = boundary;
  blockNumber += 1;
  beginBlock();
}

function completeMasteredBlock() {
  reviewMode = false;
  reviewQueue = [];
  currentReviewQuestion = null;

  const nextStep = PrepFlowNavigationRules.completedReviewStep(
    blockEnd < sessionQuestions.length
  );

  if (nextStep === "next-block") {
    showBlockSummary(true);
    return;
  }

  showFinalSummary();
}

function completeFirstPassBlock() {
  const nextStep = PrepFlowNavigationRules.completedFirstPassStep(
    blockMissed.length,
    blockEnd < sessionQuestions.length
  );

  if (nextStep === "review") {
    startReview();
    return;
  }

  if (nextStep === "next-block") {
    showBlockSummary(true);
    return;
  }

  showFinalSummary();
}

function startSelectedQuestions(selectedQuestions, subjectTitle) {
  sessionShuffleQuestions = shuffleQuestionsToggle.checked;
  sessionQuestions = PrepFlowOrderRules.orderQuestions(
    selectedQuestions,
    sessionShuffleQuestions
  );

  if (sessionQuestions.length === 0) {
    status.hidden = false;
    status.textContent =
      "No supported PrepFlow questions were found in that selection.";
    return;
  }

  currentSubject = subjectTitle || "Custom Quiz";
  sessionBlockSize = Number(globalBlockSizeSelect.value) || 15;

  blockStart = 0;
  blockNumber = 1;
  firstPassCorrect = 0;
  firstPassMissed = 0;
  firstPassSkipped = 0;

  beginBlock();
}

async function startQuiz() {
  const selectedQuestions = [];

  try {
    for (const selection of selectedChapters.values()) {
      const pack = await loadPack(selection.packPath);

      pack.questions.forEach((question) => {
        const key = `${question.chapter}|${question.chapter_title}`;

        if (
          key === selection.chapterKey
          && [
            "mc",
            "multiple_choice",
            "multiple_response",
            "completion",
            "ordered_response",
          ].includes(question.type || question.question_type)
        ) {
          selectedQuestions.push({
            packPath: selection.packPath,
            questionId: question.id,
          });
        }
      });
    }
  } catch (error) {
    status.hidden = false;
    status.textContent = error.message;
    return;
  }

  startSelectedQuestions(selectedQuestions, "Custom Quiz");
}

async function launchStudyModule(moduleRecord) {
  studyModulesStatus.hidden = true;

  try {
    await loadBookCatalog();

    const response = await fetch(moduleRecord.manifest_path);
    if (!response.ok) throw new Error("Could not load " + moduleRecord.title + ".");
    const module = await response.json();
    if (
      module.format !== "prepflow_module_selection"
      || module.module_id !== moduleRecord.id
      || !Array.isArray(module.groups)
    ) {
      throw new Error("The selected study module has an unsupported format.");
    }

    const packPaths = new Map(
      packCatalog.map((pack) => [pack.id, pack.path])
    );
    Object.entries(moduleRecord.supplemental_pack_paths || {}).forEach(
      ([packId, packPath]) => packPaths.set(packId, packPath)
    );

    const selectedQuestions = [];
    const seenQuestionRefs = new Set();
    const supportedTypes = new Set([
      "mc",
      "multiple_choice",
      "multiple_response",
      "completion",
      "ordered_response",
    ]);

    for (const group of module.groups) {
      const packPath = packPaths.get(group.source_pack_id);
      if (!packPath) {
        throw new Error("Missing question pack: " + group.source_pack_id);
      }
      const pack = await loadPack(packPath);
      const questionsById = new Map(pack.questions.map((question) => [question.id, question]));

      for (const chapter of group.chapters || []) {
        if (chapter.question_ids.length !== chapter.expected_question_count) {
          throw new Error("Question count mismatch in " + chapter.title + ".");
        }
        for (const questionId of chapter.question_ids) {
          const reference = packPath + "|" + questionId;
          const question = questionsById.get(questionId);
          if (seenQuestionRefs.has(reference)) {
            throw new Error("Duplicate question in " + moduleRecord.title + ".");
          }
          if (!question) {
            throw new Error("Question not found in source pack: " + questionId);
          }
          if (!supportedTypes.has(question.type || question.question_type)) {
            throw new Error("Unsupported question type for " + questionId + ".");
          }

          seenQuestionRefs.add(reference);
          selectedQuestions.push({ packPath, questionId });
        }
      }
    }

    if (selectedQuestions.length !== moduleRecord.question_count) {
      throw new Error("The loaded question count does not match the module catalog.");
    }

    startSelectedQuestions(selectedQuestions, module.title);
  } catch (error) {
    studyModulesStatus.textContent = error.message;
    studyModulesStatus.hidden = false;
  }
}

async function resumeSavedSession() {
  const saved = readSavedSession();

  if (!saved) {
    showSubjects();
    return;
  }

  try {
    currentSubject = saved.currentSubject || "Custom Quiz";
    sessionQuestions = saved.sessionQuestions || [];
    sessionShuffleQuestions = saved.sessionShuffleQuestions !== false;
    shuffleQuestionsToggle.checked = sessionShuffleQuestions;

    const packPaths = new Set(
      sessionQuestions
        .map((reference) => reference && reference.packPath)
        .filter(Boolean)
    );

    for (const packPath of packPaths) {
      await loadPack(packPath);
    }

    sessionBlockSize = saved.sessionBlockSize;
    blockStart = saved.blockStart;
    blockEnd = saved.blockEnd;
    questionIndex = saved.questionIndex;
    blockNumber = saved.blockNumber;

    firstPassCorrect = saved.firstPassCorrect;
    firstPassMissed = saved.firstPassMissed;
    firstPassSkipped = saved.firstPassSkipped || 0;
    blockCorrect = saved.blockCorrect;
    blockSkipped = saved.blockSkipped || 0;
    blockMissed = saved.blockMissed || [];

    reviewQueue = saved.reviewQueue || [];
    reviewMode = Boolean(saved.reviewMode);
    currentReviewQuestion = saved.currentReviewQuestion;

    if (saved.screen === "feedback") {
      advanceFromFeedback();
    } else if (saved.screen === "block-progress") {
      showBlockSummary(true);
    } else if (
      saved.screen === "block-summary"
      || saved.screen === "mastered-summary"
    ) {
      const mastered = saved.screen === "mastered-summary";

      if (usesMobilePortraitPresentation()) {
        if (!mastered && blockMissed.length > 0) {
          startReview();
        } else if (blockEnd < sessionQuestions.length) {
          advanceToNextBlock(saved.blockEnd);
        } else {
          showFinalSummary();
        }
      } else {
        showBlockSummary(mastered);
      }
    } else if (reviewMode && !currentReviewQuestion) {
      advanceFromFeedback();
    } else if (!reviewMode && questionIndex >= blockEnd) {
      completeFirstPassBlock();
    } else {
      showQuestion();
    }
  } catch (error) {
    clearSavedSession();
    showSubjects();
    status.textContent = `Saved session could not be restored: ${error.message}`;
  }
}

submitAnswer.addEventListener("click", () => {
  if (questionSubmissionState !== "idle") {
    return;
  }

  const question = currentQuestion();
  const questionKind = PrepFlowQuizRules.questionKind(question);
  const selectedAnswers = questionKind === "text"
    ? [answerChoices.querySelector('input[name="answer-text"]')?.value || ""]
    : questionKind === "ordered"
      ? [...answerChoices.querySelectorAll(".ordered-answer")].map((row) => row.dataset.label)
      : [...answerChoices.querySelectorAll('input[name="answer"]:checked')].map((input) => input.value);

  if (selectedAnswers.length === 0 || selectedAnswers.every((answer) => !String(answer).trim())) {
    return;
  }

  questionSubmissionState = "grading";
  submitAnswer.disabled = true;
  skipQuestionButton.disabled = true;

  let scoringStarted = false;

  try {
    const { isCorrect, correctAnswers } =
      PrepFlowQuizRules.evaluateAnswer(question, selectedAnswers);

    scoringStarted = true;

    if (isCorrect) {
      feedbackResult.textContent = "Correct!";

      if (!reviewMode) {
        firstPassCorrect += 1;
        blockCorrect += 1;
      }
    } else {
      feedbackResult.textContent =
        `Incorrect. Correct answer: ${correctAnswers.join(", ")}`;

      if (reviewMode) {
        reviewQueue = PrepFlowReviewRules.queueAfterAnswer(
          reviewQueue,
          currentReviewQuestion,
          false
        );
      } else {
        firstPassMissed += 1;
        blockMissed.push(sessionQuestions[questionIndex]);
      }
    }

    questionSubmissionState = "submitted";
    feedbackRationale.textContent = question.rationale || "";

    document.dispatchEvent(new CustomEvent("prepflow:answer-graded", {
      detail: {
        isCorrect,
        selectedAnswers,
        correctAnswers,
        choices: question.choices.map((choice) => ({
          label: choice.label,
          text: choice.text,
        })),
        multipleResponse: PrepFlowQuizRules.isMultipleResponseQuestion(question),
      },
    }));
    answerChoices.hidden = true;
    feedback.hidden = false;

    answerChoices.querySelectorAll("input, button").forEach((control) => {
      control.disabled = true;
    });

    quizScore.textContent = PrepFlowDisplayRules.runningScoreText(
      firstPassCorrect,
      firstPassMissed
    );

    submitAnswer.hidden = true;
    continueButton.hidden = false;
    saveSession("feedback");
  } catch (error) {
    if (!scoringStarted) {
      questionSubmissionState = "idle";
      submitAnswer.disabled = false;
    }

    throw error;
  }
});

function sameQuestionReference(left, right) {
  return Boolean(
    left
    && right
    && left.packPath === right.packPath
    && left.questionId === right.questionId
  );
}

function skipCurrentQuestion() {
  if (questionSubmissionState !== "idle") {
    return;
  }

  questionSubmissionState = "skipped";
  skipQuestionButton.disabled = true;

  if (reviewMode) {
    const skipped = currentReviewQuestion;

    firstPassMissed = Math.max(0, firstPassMissed - 1);
    firstPassSkipped += 1;
    blockSkipped += 1;

    blockMissed = blockMissed.filter(
      (reference) => !sameQuestionReference(reference, skipped)
    );
    reviewQueue = reviewQueue.filter(
      (reference) => !sameQuestionReference(reference, skipped)
    );

    advanceFromFeedback();
    return;
  }

  firstPassSkipped += 1;
  blockSkipped += 1;
  advanceFromFeedback();
}

skipQuestionButton.addEventListener("click", skipCurrentQuestion);

function advanceFromFeedback() {
  if (reviewMode) {
    const nextStep = PrepFlowReviewRules.nextReviewStep(reviewQueue);
    reviewQueue = nextStep.reviewQueue;
    currentReviewQuestion = nextStep.currentQuestion;

    if (nextStep.finished) {
      completeMasteredBlock();
      return;
    }

    showQuestion();
    return;
  }

  const nextStep = PrepFlowNavigationRules.nextQuestionStep(
    questionIndex,
    blockEnd
  );
  questionIndex = nextStep.questionIndex;

  if (nextStep.blockComplete) {
    completeFirstPassBlock();
    return;
  }

  showQuestion();
}

continueButton.addEventListener("click", advanceFromFeedback);

summaryAction.addEventListener("click", () => {
  const action = summaryAction.dataset.action;

  if (action === "review") {
    startReview();
    return;
  }

  if (action === "next-block") {
    advanceToNextBlock(summaryAction.dataset.blockEnd);
    return;
  }

  if (action === "finish") {
    showFinalSummary();
    return;
  }

  clearSavedSession();
  selectedChapters.clear();
  showSubjects();
});

openQuizBuilderButton.addEventListener("click", showQuizBuilder);
openStudyModulesButton.addEventListener("click", showStudyModules);
resumeStudyModulesButton.addEventListener("click", showStudyModules);
closeStudyModulesButton.addEventListener("click", () => {
  showSubjects();
});
studyModulesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-study-module-id]");
  if (!button) return;

  const moduleRecord = studyModules.find(
    (module) => module.id === button.dataset.studyModuleId
  );
  if (moduleRecord) launchStudyModule(moduleRecord);
});

closeQuizBuilderButton.addEventListener("click", () => {
  document.body.classList.remove("builder-open");
  showSubjects();
});
doneChaptersButton.addEventListener("click", showQuizBuilder);

chapterPreviousButton.addEventListener("click", () => {
  showChapterSpread(currentChapterSpread - 1);
});

chapterNextButton.addEventListener("click", () => {
  showChapterSpread(currentChapterSpread + 1);
});

chapterPageNumbers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chapter-spread]");

  if (!button) {
    return;
  }

  showChapterSpread(Number(button.dataset.chapterSpread));
});

const BOOK_LAUNCH_DURATION_MS = 1150;
const OPEN_BOOK_REVEAL_MS = 760;
const OPEN_BOOK_TOTAL_MS = 1500;
const BOOK_CLOSE_DURATION_MS = 760;
const MOBILE_BOOK_LAUNCH_DURATION_MS = 240;
const MOBILE_BOOK_CLOSE_DURATION_MS = 220;

let bookLaunchInProgress = false;
let bookCloseInProgress = false;
let activeBookButton = null;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function usesMobilePortraitPresentation() {
  return (
    document.documentElement.classList.contains("mobile-portrait")
    && window.matchMedia(
      "(max-width: 760px) and (orientation: portrait)"
    ).matches
  );
}

async function launchBook(button) {
  if (bookLaunchInProgress) {
    return;
  }

  activeBookButton = button;

  const usesMobileTransition = usesMobilePortraitPresentation();
  const usesOpenBookTransition = !usesMobileTransition;

  bookLaunchInProgress = true;
  document.body.classList.add("book-launching");
  button.classList.add("is-launching");
  button.setAttribute("aria-busy", "true");

  try {
    if (usesMobileTransition) {
      await wait(MOBILE_BOOK_LAUNCH_DURATION_MS);
    } else if (usesOpenBookTransition) {
      await wait(OPEN_BOOK_REVEAL_MS);

      quizBuilderOpenBook.hidden = false;

      /*
        Allow the browser to establish the hidden starting state before
        activating the fade-and-settle transition.
      */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.add("book-opening");
        });
      });

      await wait(
        OPEN_BOOK_TOTAL_MS - OPEN_BOOK_REVEAL_MS
      );
    } else {
      await wait(BOOK_LAUNCH_DURATION_MS);
    }

    await showChapters(button);
  } finally {
    button.classList.remove("is-launching");
    button.removeAttribute("aria-busy");

    document.body.classList.remove(
      "book-launching",
      "book-opening"
    );

    quizBuilderOpenBook.hidden = true;
    bookLaunchInProgress = false;
  }
}

async function closeCurrentBook() {
  if (bookCloseInProgress || bookLaunchInProgress) {
    return;
  }

  const usesRealOpenBook =
    document.body.classList.contains("real-book-chapters");

  if (!usesRealOpenBook || !activeBookButton) {
    showQuizBuilder();
    activeBookButton = null;
    return;
  }

  bookCloseInProgress = true;

  document.body.classList.add("book-closing");
  activeBookButton.classList.add("is-closing");
  activeBookButton.setAttribute("aria-busy", "true");

  try {
    await wait(
      usesMobilePortraitPresentation()
        ? MOBILE_BOOK_CLOSE_DURATION_MS
        : BOOK_CLOSE_DURATION_MS
    );
    showQuizBuilder();
  } finally {
    document.body.classList.remove("book-closing");
    activeBookButton.classList.remove("is-closing");
    activeBookButton.removeAttribute("aria-busy");

    activeBookButton = null;
    bookCloseInProgress = false;
  }
}

document.querySelector("#back-button").addEventListener(
  "click",
  closeCurrentBook
);

chapterScreen.addEventListener("click", (event) => {
  if (
    event.target.closest(
      ".chapter-book-hit-area, .chapter-header, .chapter-list, .chapter-pagination"
    )
  ) {
    return;
  }

  closeCurrentBook();
});
document.querySelector("#exit-quiz").addEventListener("click", showSubjects);
document.querySelector("#summary-exit").addEventListener("click", showSubjects);
copyQuestionIdButton?.addEventListener("click", () => {
  copyCurrentQuestionId().catch((error) => showCopyStatus(error.message));
});
copyQuestionReportButton?.addEventListener("click", () => {
  copyCurrentQuestionReport().catch((error) => showCopyStatus(error.message));
});

document.querySelector("#select-all").addEventListener("click", () => {
  chapterList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = true;

    const selectionKey = `${currentPackPath}|${checkbox.value}`;
    selectedChapters.set(selectionKey, {
      packPath: currentPackPath,
      subject: currentSubject,
      chapterKey: checkbox.value,
      questionCount: Number(checkbox.dataset.questionCount || 0),
    });
  });

  updateSelectionStatus();
});

document.querySelector("#clear-all").addEventListener("click", () => {
  chapterList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
    selectedChapters.delete(`${currentPackPath}|${checkbox.value}`);
  });

  updateSelectionStatus();
});

resumeSessionButton.addEventListener("click", resumeSavedSession);

discardSessionButton.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Starting a new quiz will replace your saved quiz progress. Continue?"
  );

  if (!confirmed) {
    return;
  }

  clearSavedSession();
  selectedChapters.clear();
  showQuizBuilder();
});

startButton.addEventListener("click", startQuiz);
buildQuizButton.addEventListener("click", startQuiz);

globalBlockSizeSelect.addEventListener("change", () => {
  blockSizeSelect.value = globalBlockSizeSelect.value;
});

clearSelectionsButton.addEventListener("click", () => {
  selectedChapters.clear();
  updateSelectionStatus();
});

showSubjects();
updateSelectionStatus();
loadBookCatalog().catch(() => {});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("PrepFlow service worker registration failed:", error);
    });
  });
}
