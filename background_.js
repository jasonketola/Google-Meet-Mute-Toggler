const MEET_URL = 'https://meet.google.com/'
const MEET_URL_AST = 'https://meet.google.com/*'

const TEAMS_URL = 'https://meet.google.com/'
const TEAMS_URL_AST = 'https://meet.google.com/*'

const ICON_GRAY48 = chrome.runtime.getURL('icons/M_gray48.png')
const ICON_GRAY128 = chrome.runtime.getURL('icons/M_gray128.png')
const ICON_RED128 = chrome.runtime.getURL('icons/M_red128.png')
const ICON_GREEN128 = chrome.runtime.getURL('icons/M_green128.png')

// Sets the icon color appropriately
function updateIcon(statuses) {
  const muted = statuses[0].result[0]
  const joined_status = statuses[0].result[1]

  // Set icon to gray if not in an active Meet
  // Set icon to red if in an active Meet and muted
  // Otherwise set icon to green, meaning unmuted in an active meet
  const icon = (!joined_status) ? ICON_GRAY128 : (muted) ? ICON_RED128 : ICON_GREEN128
  chrome.action.setIcon({ path: icon })
}

// Global variables. Bad practice I know.

let meetTabId = -1 // Keeps track of id of which tab to interact with
let onlyTab = false // If only meet.google.com is open (doesn't include meet.google.com/xxx-xxxx-xxx)
let isOpen = false // If meet.google.com is open
let alerts = false // If an alert has been triggered related to having too many meet windows open
let meetCount = 0 // Number of meet.google.com/xxx-xxxx-xxx windows open

// Checks which tabs are open, which should be interacted with, and alerts if too many meets are open
function assessTabs(tab) {
  chrome.tabs.query({ url: MEET_URL_AST }, function (tabs) {
    const response = checkMeetingTabs(tabs, MEET_URL, 'Google Meets')
    isOpen = response.isOpen
    meetTabId = response.tabId
    tabCount = response.tabCount
    alerts = response.alerts
    onlyTab = response.onlyTab
  })

  return {
    isOpen,
    meetTabId,
    tabCount,
    alerts,
    onlyTab
  }
}

// Inject keypress for toggling mute into appropriate tab
function sendKeypress(tab) {
  chrome.tabs.query({ url: MEET_URL_AST }, function (tabs) {
    if (meetTabId != -1) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[meetTabId].id },
        files: ['src/sendKeypress.js'],
      })
    }
  })
}

// Research meet is active and mute status
function researchTab(tab) {
  chrome.tabs.query({ url: MEET_URL_AST }, function (tabs) {
    if (meetCount == 1) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[meetTabId].id },
          func: checkMute,
        },
        updateIcon,
      )
    }
  })
}

function checkMute() {
  let muted = false
  let joined_status = true
  for (let elem of document.getElementsByTagName('*')) {
    if ((elem.innerHTML.indexOf('Join now') != -1) || (elem.innerHTML.indexOf('Rejoin') != -1)) {
      joined_status = false
    } else if (elem.matches('[aria-label~="microphone"]') && ['DIV', 'BUTTON'].includes(elem.nodeName)) {
      // FIXME: 想定外の要素まで取れているためisMutedが取れなかったらスキップする
      if (elem.dataset?.isMuted === undefined) continue
      muted = JSON.parse(elem.dataset?.isMuted)
    }
  }
  return [muted, joined_status]
}

// Functions to run when icon is clicked.
chrome.action.onClicked.addListener(function (tab) {
  assessTabs()
  sendKeypress()
  setTimeout(researchTab, 50)
})

// When a meet.google.com/* window is opened (or closed) run functions
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete' || changeInfo.discarded) {
    assessTabs(tab)
    researchTab(tab)
  }
})

// Run functions when alarm goes off
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === '1min') {
    assessTabs()
    researchTab()
  }
})

// Run functions on load
assessTabs()
researchTab()

// Reset icon and badge on onload / cleanup in case of crash
addEventListener('beforeunload', () => {
  chrome.action.setIcon({ path: ICON_GRAY128 })
  chrome.action.setBadgeText({ text: '' })
})

// ショートカットキー入力時の処理
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-mute') {
    const response = assessTabs()
    sendKeypress()
    setTimeout(researchTab, 50)
  }
})

function checkMeetingTabs(tabs, url, serviceName = 'Meeting Service') {
  // Reset global variable values
  let isOpen = false
  let tabId = -1
  let tabCount = 0
  let alerts = false

  // Checks if meeting tabs is open and how many
  tabs.forEach((item, index) => {
    if (item.url == url) {
      isOpen = true
    } else {
      tabCount++
    }
  })

  // Checks if only tab is open
  const onlyTab = isOpen && tabCount == 0

  // If tabs are open set alarm, so that they can be monitored
  if (tabCount > 0) {
    // https://developer.chrome.com/docs/extensions/reference/alarms/#method-create
    // To help you debug your app or extension, when you've loaded it unpacked, there's no limit to how often the alarm can fire.
    chrome.alarms.create('1min', {
      periodInMinutes: 0.05,
    })
  }

  // If tabs are all closed, stop the alarm and reset icon and badge
  if (tabCount === 0) {
    chrome.alarms.clear('1min')
    chrome.action.setIcon({ path: ICON_GRAY128 })
    chrome.action.setBadgeText({ text: '' })
  }

  // If only one tab is open reset alert
  if (tabCount === 1) {
    alerts = false
    chrome.action.setBadgeText({ text: '' })
  }

  // If an alert hasn't been triggered and if more than one tabs is open, alert to close some
  tabs.forEach((item, index) => {
    if (!alerts) {
      if (tabCount > 1) {
        chrome.notifications.create(
          '',
          {
            type: 'basic',
            title: '',
            message: `You have ${tabCount} ${serviceName} open. Close all but one.`,
            iconUrl: ICON_GRAY128,
          },
        )
        alerts = true
        chrome.action.setBadgeText({ text: 'Err' })
      } else {
        // If only one meet is open and no alerts have been triggered, set x with the id of the tab to interact with
        tabId = index
      }
    }
  })

  return {
    isOpen,
    tabId,
    tabCount,
    alerts,
    onlyTab
  }
}


// chrome.tabs.onUpdated.addListener((tab) => {
//   chrome.tabs.get(tab, (tabs) => {
//     console.log('onUpdated: ', tabs)
//   })
//   // console.log('onUpdated: ', tab?.pendingUrl, tab?.status, tab?.title, tab)
// })

// chrome.tabs.onCreated.addListener((tab) => {
//   console.log('onCreated: ', tab?.pendingUrl, tab?.status, tab?.title, tab)
//   // if (meetTabId != -1) {
//   //   chrome.scripting.executeScript(
//   //     {
//   //       target: { tabId: tabs[meetTabId].id },
//   //       func: watchMicrophone,
//   //     }
//   //   )
//   // }
// })

// const watchMicrophone = () => {
//   console.log('start microphoneListener.js')
//   // body監視（Join nowボタンの監視が難しいため）
//   const body = document.querySelector("body")

//   // 監視したい要素（マイクのミュート切り替えボタン）
//   const MicrophoneButton = '#ow3 > div.T4LgNb > div > div:nth-child(14) > div.crqnQb > div.fJsklc.nulMpf.Didmac.G03iKb > div > div > div.Tmb7Fd > div > div.fswXR > div > div.GKGgdd > span > button'

//   // 監視したい要素が現れたらbodyの監視をやめてボタンの監視に進む
//   const bodyObserver = new MutationObserver((_mutationsList, observer) => {
//     console.log(document.querySelector(MicrophoneButton))
//     if (document.querySelector(MicrophoneButton) === null) return

//     observer.disconnect()
//     watchMicrophoneButton()
//   })
//   bodyObserver.observe(body, { childList: true, subtree: true })

//   // ボタン監視処理
//   const watchMicrophoneButton = () => {
//     console.log("start button watch!!!!!!!!!!!!!!!!", document.querySelector(MicrophoneButton).dataset?.isMuted)
//     let isChanged = false
//     let isMuted = false
//     const observer = new MutationObserver((mutationsList, observer) => {
//       // ボタンの切り替わり監視
//       mutationsList.forEach((mutation) => {
//         if (isMuted !== JSON.parse(mutation.target.dataset?.isMuted)) {
//           isChanged = true
//           isMuted = JSON.parse(mutation.target.dataset?.isMuted)
//         }
//       })

//       // 切り替わってたら処理実行
//       if (isChanged) {
//         isChanged = false
//         console.log('isMuted: ', isMuted)
//         // researchTab()
//         updateIcon({ result: [isMuted, true] })
//       }
//     })
//     observer.observe(document.querySelector(MicrophoneButton), { attributes: true })
//   }
// }