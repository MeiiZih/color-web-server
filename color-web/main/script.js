const questions = [
    {
        question: "你在參加大型聚會時，通常是怎樣的人？",
        options: ["A. 主動結交新朋友，熱情互動", "B. 帶來歡笑和愉快氣氛", "C. 安靜觀察，不喜歡成為焦點", "D. 喜歡獨自待著，遠離人群"]
    },
    {
        question: "空閒時你喜歡戶外活動還是待在家裡？",
        options: ["A. 我喜歡組織並參加充滿活力的戶外活動", "B. 我喜歡偶爾參加戶外活動，享受新鮮空氣和輕鬆氛圍", "C. 我更喜歡在家專注於自己的興趣", "D. 我很享受獨自在家安靜的時間"]
    },
    {
        question: "在不熟悉的話題討論中，你會怎麼做？",
        options: ["A. 主動加入討論並表達意見", "B. 熱心聽並適時支持他人觀點", "C. 默默觀察，偶爾點頭認同，內心思考但不參與討論", "D. 遠離討論，關注自己感興趣的事"]
    },
    {
        question: "你在大群體中是否容易感到疲憊，需要時間獨處來恢復？",
        options: ["A. 群體中感到精力充沛，自在", "B. 愉快但需要偶爾獨處來整", "C. 群體中冷靜，但後需獨處恢復", "D. 容易感到疲憊，需要長時間獨處"]
    },
    {
        question: "你偏向於哪種旅行方式？",
        options: ["A. 不喜歡獨自旅行，感到孤獨和不安", "B. 不喜歡獨自旅行，覺得無聊", "C. 喜歡獨自旅行，享受不被打擾", "D. 喜歡獨自旅行，感到滿足和放鬆"]
    },
    {
        question: "當你想到新事物時，你會怎麼做？",
        options: ["A. 我會感到興奮並想要一股腦地把它變成現實", "B. 我會開心地與朋友分享，並嘗試各種可能性", "C. 我會冷靜地評估可行性，並規劃好進度", "D. 我會先保存這個想法，等他人提到時再分享"]
    },
    {
        question: "當你參與各種形式的創造性表達時，你會怎麼做？",
        options: ["A. 我會全身心投入，享受創作中的活力與興奮感", "B. 我經常從生活中獲得靈感，並愉快地轉化為藝術創作", "C. 我更喜歡運用現有技能，參考他人的作品達到理想效果", "D. 我會選擇簡單的創作方式，因為這讓我感到有安全感"]
    },
    {
        question: "你會想像自己扮演什麼樣的科幻角色？",
        options: ["A. 我會成為一我會成為一位充滿熱情的宇宙探險家，享受未知星球探索的過程。", "B. 我會化身為想法多元且有創新能力的科學家，推動未來的可能性", "C. 我更傾向於做冷靜實際的太空站管理員，負責協調與管理各種資源和設施", "D. 我會選擇做一個遵守醫療準則的太空醫護人員，確保航行過程中的所有乘員都安全健康"]
    },
    {
        question: "當朋友開始討論抽象的哲學問題時，你會怎麼參與討論？",
        options: ["A. 我會感到興奮，因為哲學有許多不同的角度，可以與其他人辯論", "B. 我會覺得這樣的討論很有趣，並且在輕鬆的氛圍中分享和交流想法", "C. 我會覺得這樣的討論很實際，因為包含了許多的知識且有一套系統性的邏輯", "D. 我會審慎去討論這些抽象的議題，因為有憑有據能讓我更安心"]
    },
    {
        question: "當你需要完成一個多步驟的任務時，你會怎麼做？",
        options: ["A. 我會急於想完成任務，可能會省略一些步驟來加快速度", "B. 我會以樂觀的心情進行，並在過程中發現創新的方式", "C. 我會按部就班，冷靜且有條理地完成每個步驟", "D. 我會擔心遺漏步驟，選擇穩妥和安全的方式來完成"]
    },
    {
        question: "你的一位親密朋友剛剛失去了工作，你會怎麼做？",
        options: ["A. 我會相當急迫的關心對方", "B. 我會給予對方一個溫暖的擁抱", "C. 我會安靜地當個聽眾，並給予他建議", "D. 我會和對方聊聊了解實際情況"]
    },
    {
        question: "你在工作中面臨一個重要的決策，需要在兩個方案中做出選擇。以下哪個情境比較符合你？",
        options: ["A. 我會感到相當急切且焦慮", "B. 我會有很多想法，所以始終無法做出選擇", "C. 我會穩定好自己的心態後再作決定", "D. 我會冷靜下來好好分析後再作出選擇"]
    },
    {
        question: "你正在參加一場朋友的婚禮，看到新郎新娘在台上交換誓言。你會感到如何？",
        options: ["A. 我會感到相當激動", "B. 我會感到這一刻是美好並快樂的", "C. 我感覺此刻是相當和諧的", "D. 我能感受到他們彼此間的深情"]
    },
    {
        question: "你收到了一封來自老朋友的信。你認為自己會有什麼樣的反應？",
        options: ["A. 我會回憶起那些快樂時光，感受到來自老朋友滿滿的愛", "B. 我會因為收到老朋友的信而感到開心、暖心", "C. 我會冷靜地讀完信，心中一片祥和、平靜，不會有太多的波動", "D. 我不會打開那封信，因為我會害怕回憶起過往的事。"]
    },
    {
        question: "你在一個團隊項目中，團隊成員之間出現了嚴重的分歧，這時你會怎麼做？",
        options: ["A. 我會很急躁，不知道該怎麼辦", "B. 我會感到相當不安，擔心成員會因此傷了和氣", "C. 我會試圖安撫雙方成員，先讓成員平靜下來再說", "D. 我會先冷靜下來思考，再提出自己的見解"]
    },
    {
        question: "你最喜歡使用的規劃工具是什麼呢？",
        options: ["A.紙本筆記本，因為可以隨時取得", "B. Canva，因為我喜歡漂亮版面和其他創意圖文", "C. Google日曆，因為我喜歡簡約可以安排所有進度的工具", "D. Google日曆+倒數日工具，因為我害怕忘記重要的事所以需要倒數日提醒"]
    },
    {
        question: "你在生活中是什麼樣的生活型態？",
        options: ["A. 我喜歡一次把事情做完", "B. 我喜歡一邊做事情，一邊放鬆", "C. 我會先安排事情的進度", "D. 我會慢慢把事情做完"]
    },
    {
        question: "你的朋友最近快要生日了，你會怎麼挑禮物？",
        options: ["A. 我會在生日當天順路買禮物", "B. 我會放在心上，有靈感的當下再去買禮物", "C. 我會回想朋友有提過什麼喜歡的東西，並提前買好", "D. 我會提前準備，但害怕禮物朋友會不喜歡。"]
    },
    {
        question: "你覺得自己最像是電影中的什麼角色？",
        options: ["A. 熱血勇往直前的英雄", "B. 隨機應變的秘密特工", "C. 沉穩的經紀人公關", "D. 理性智慧的魔法師"]
    },
    {
        question: "當你今天在做一份報告時，你會怎麼去完成它？",
        options: ["A. 我通常會一鼓作氣快速地找資料完成", "B. 我會休息一下，看到有靈感的東西才會開始做", "C. 我會列出大綱摘要並循序漸進完成報告", "D. 我會收集很多資料來參考，做出一份我最滿意的報告"]
    }
];

let currentQuestionIndex = 0;
const answers = []; // 儲存每一題的回答

function loadQuestion() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    container.classList.add('has-question');
    const q = questions[currentQuestionIndex];

    const questionContainer = document.createElement('div');
    questionContainer.className = 'question-container';

    const questionElement = document.createElement('div');
    questionElement.innerHTML = `<p>${currentQuestionIndex + 1}. ${q.question}</p>`;

    // 添加選項
    q.options.forEach(option => {
        const isChecked = answers[currentQuestionIndex] === option ? 'checked' : '';
        questionElement.innerHTML += `
            <label>
                <input type="radio" name="question" value="${option}" ${isChecked} required>
                ${option}
            </label><br>
        `;
    });

    questionContainer.appendChild(questionElement);

    // 創建按鈕容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    // 只在第2題開始顯示"上一題"按鈕
    if (currentQuestionIndex > 0) {
        const prevButton = document.createElement('button');
        prevButton.textContent = '上一題';
        prevButton.id = 'prev-button';
        buttonContainer.appendChild(prevButton);

        prevButton.addEventListener('click', () => {
            // 儲存當前答案
            const selectedOption = document.querySelector('input[name="question"]:checked');
            if (selectedOption) {
                answers[currentQuestionIndex] = selectedOption.value;
            }
            currentQuestionIndex--;
            loadQuestion();
        });
    }

    const nextButton = document.createElement('button');
    // 在最後一題時顯示"送出"而不是"下一題"
    nextButton.textContent = currentQuestionIndex === questions.length - 1 ? '送出' : '下一題';
    nextButton.id = 'next-button';
    buttonContainer.appendChild(nextButton);
    
    questionContainer.appendChild(buttonContainer);
    container.appendChild(questionContainer);

    // 為下一題/送出按鈕添加事件監聽器
    nextButton.addEventListener('click', () => {
        const selectedOption = document.querySelector('input[name="question"]:checked');
        if (selectedOption) {
            // 儲存當前答案
            answers[currentQuestionIndex] = selectedOption.value;

            if (currentQuestionIndex === questions.length - 1) {
                submitAnswers();
            } else {
                currentQuestionIndex++;
                loadQuestion();
            }
        } else {
            alert('請選擇一個選項！');
        }
    });
}

async function submitAnswers() {
    const userMBTI = localStorage.getItem('userMBTI');
    
    try {
        const response = await fetch('http://20.57.128.97:3000/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                answers: answers,
                mbti: userMBTI,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '提交失敗');
        }

        // 儲存答案到 localStorage 以在結果頁面顯示
        localStorage.setItem('surveyAnswers', JSON.stringify(answers));
        
        // 跳轉到結果頁面
        window.location.href = './result.html';
    } catch (error) {
        console.error("提交失敗:", error);
        alert("提交失敗，請稍後重試！");
    }
}

// 啟動背景顏色變化
function changeBackgroundColor() {
    const colors = ['#FFDDC1', '#FFABAB', '#FFC3A0', '#FF677D', '#D4A5A5'];
    let index = 0;
    setInterval(() => {
        document.body.style.backgroundColor = colors[index];
        index = (index + 1) % colors.length;
    }, 3000); // 每3秒變化一次顏色
}

// 初始化
initialize();
changeBackgroundColor();

// 在開始問卷時添加
startQuizButton.addEventListener('click', () => {
    // ... 其他代碼 ...
    container.classList.add('has-question');
    loadQuestion();
});

/**
 * 用戶認證和資料庫操作相關功能
 */

// 用戶註冊
async function registerUser(nickname, email, password) {
    try {
        const response = await fetch('http://20.57.128.97:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nickname,
                email,
                password
            }),
        });

        return await response.json();
    } catch (error) {
        console.error('註冊錯誤:', error);
        throw new Error('註冊失敗，請稍後重試');
    }
}

// 用戶登入
async function loginUser(email, password) {
    try {
        const response = await fetch('http://20.57.128.97:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password
            }),
        });

        return await response.json();
    } catch (error) {
        console.error('登入錯誤:', error);
        throw new Error('登入失敗，請稍後重試');
    }
}

// 驗證用戶 token
async function verifyToken(token) {
    try {
        const response = await fetch('http://20.57.128.97:3000/api/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        return response.ok;
    } catch (error) {
        console.error('Token 驗證錯誤:', error);
        return false;
    }
}

// 更新用戶資料
async function updateUserProfile(token, userData) {
    try {
        const response = await fetch('http://20.57.128.97:3000/api/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        return await response.json();
    } catch (error) {
        console.error('更新用戶資料錯誤:', error);
        throw new Error('更新失敗，請稍後重試');
    }
}

// 獲取用戶測驗歷史
async function getUserHistory(token) {
    try {
        const response = await fetch('http://20.57.128.97:3000/api/history', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        return await response.json();
    } catch (error) {
        console.error('獲取歷史記錄錯誤:', error);
        throw new Error('獲取歷史記錄失敗，請稍後重試');
    }
}

// 保存測驗結果
async function saveTestResult(token, testData) {
    try {
        const response = await fetch('http://20.57.128.97:3000/api/result', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
        });

        return await response.json();
    } catch (error) {
        console.error('保存測驗結果錯誤:', error);
        throw new Error('保存結果失敗，請稍後重試');
    }
}

// 檢查用戶登入狀態
function checkLoginStatus() {
    const token = localStorage.getItem('userToken');
    if (!token) {
        return false;
    }
    return verifyToken(token);
}

// 登出用戶
function logoutUser() {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userName');
    window.location.href = '/index.html';
}

// 密碼加密（實際應用中應該在後端處理）
function hashPassword(password) {
    // 這裡應該使用更安全的加密方法
    return btoa(password);
}

// 表單驗證
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    // 密碼至少6個字符
    return password.length >= 6;
}

// 錯誤處理
function handleError(error, errorElement) {
    if (errorElement) {
        errorElement.textContent = error.message || '發生錯誤，請稍後重試';
        errorElement.classList.add('show');
    } else {
        console.error(error);
        alert(error.message || '發生錯誤，請稍後重試');
    }
}

// 導出函數
export {
    registerUser,
    loginUser,
    verifyToken,
    updateUserProfile,
    getUserHistory,
    saveTestResult,
    checkLoginStatus,
    logoutUser,
    validateEmail,
    validatePassword,
    handleError
};

// info-section 橫向carousel切換功能
document.addEventListener('DOMContentLoaded', function () {
    let infoCurrentSlide = 0;
    const infoCarousel = document.getElementById('infoCarousel');
    const infoCards = infoCarousel ? infoCarousel.querySelectorAll('.info-card') : [];
    const cardGap = 40;

    function getVisibleCount() {
        if (!infoCarousel || infoCards.length === 0) return 1;
        const containerWidth = infoCarousel.parentElement.offsetWidth;
        const cardWidth = infoCards[0].offsetWidth;
        return Math.max(1, Math.floor(containerWidth / (cardWidth + cardGap)));
    }

    window.moveInfoSlide = function(direction) {
        if (!infoCarousel || infoCards.length === 0) return;
        const cardWidth = infoCards[0].offsetWidth;
        const visibleCount = getVisibleCount();
        const maxSlide = Math.max(0, infoCards.length - visibleCount);
        infoCurrentSlide += direction;
        if (infoCurrentSlide < 0) infoCurrentSlide = 0;
        if (infoCurrentSlide > maxSlide) infoCurrentSlide = maxSlide;
        infoCarousel.style.transform = `translateX(-${infoCurrentSlide * (cardWidth + cardGap)}px)`;
    };

    window.addEventListener('resize', () => {
        infoCurrentSlide = 0;
        if (infoCarousel) infoCarousel.style.transform = 'translateX(0)';
    });
});