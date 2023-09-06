const MEET_URL = 'https://meet.google.com/'
const MEET_URL_AST = 'https://meet.google.com/*'

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
  const icon = (!joined_status) ? ICON_GRAY128 : (muted) ? ICON_GREEN128 : ICON_RED128
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

    // Reset global variable values
    isOpen = false
    meetTabId = -1
    meetCount = 0

    // Checks if meet.google.com is open and how many xxx-xxxx-xxx meets
    tabs.forEach(function (item, index) {
      if (item.url == MEET_URL) {
        isOpen = true
      } else {
        meetCount++
      }
    })

    // Checks if only meet.google.com is open
    onlyTab = isOpen && meetCount == 0

    // If xxx-xxxx-xxx meets are open set alarm, so that they can be monitored
    if (meetCount > 0) {
      chrome.alarms.create('1min', {
        delayInMinutes: 1,
        periodInMinutes: 1,
      })
    }

    // If xxx-xxxx-xxx meets are all closed, stop the alarm and reset icon and badge
    if (meetCount == 0) {
      chrome.alarms.clear('1min')
      chrome.action.setIcon({ path: ICON_GRAY128 })
      chrome.action.setBadgeText({ text: '' })
    }

    // If only one meet is open reset alert
    if (meetCount == 1) {
      alerts = false
      chrome.action.setBadgeText({ text: '' })
    }

    // If an alert hasn't been triggered and if more than one xxx-xxxx-xxx meet is open, alert to close some
    tabs.forEach(function (item, index) {
      if (!alerts) {
        if (meetCount > 1) {
          chrome.notifications.create(
            '',
            {
              type: 'basic',
              title: '',
              message: `You have ${meetCount} Google Meets open. Close all but one.`,
              iconUrl: ICON_GRAY128,
            },
          )
          alerts = true
          chrome.action.setBadgeText({ text: 'Err' })
        } else {
          // If only one meet is open and no alerts have been triggered, set x with the id of the tab to interact with
          meetTabId = index
        }
      }
    })
  })
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
  researchTab()
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
    assessTabs()
    sendKeypress()
    researchTab()
  }
})
