/**
 * Copyright (c) 2017 Kenny Do
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { Action, Dispatch } from 'redux';
import { checkIfProtected } from '../services/BrowserActionService';
import { cleanCookiesOperation } from '../services/CleanupService';
import { getSetting, getStoreId } from '../services/Libs';
import {
  ADD_EXPRESSION,
  INCREMENT_COOKIE_DELETED_COUNTER,
  ReduxConstants,
  REMOVE_EXPRESSION,
  RESET_COOKIE_DELETED_COUNTER,
  RESET_SETTINGS,
  UPDATE_EXPRESSION,
  UPDATE_SETTING,
} from '../typings/ReduxConstants';
import { initialState } from './State';

const COOKIE_CLEANUP_NOTIFICATION = 'COOKIE_CLEANUP_NOTIFICATION';

export const addExpressionUI = (payload: Expression): ADD_EXPRESSION => ({
  payload,
  type: ReduxConstants.ADD_EXPRESSION,
});

export const removeExpressionUI = (payload: Expression): REMOVE_EXPRESSION => ({
  payload,
  type: ReduxConstants.REMOVE_EXPRESSION,
});
export const updateExpressionUI = (payload: Expression): UPDATE_EXPRESSION => ({
  payload,
  type: ReduxConstants.UPDATE_EXPRESSION,
});

export const addExpression = (payload: Expression) => (
  dispatch: Dispatch<any>,
  getState: GetState,
) => {
  dispatch({
    payload: {
      ...payload,
      // Sanitize the payload's storeId
      storeId: getStoreId(getState(), payload.storeId),
    },
    type: ReduxConstants.ADD_EXPRESSION,
  });
  checkIfProtected(getState());
};

export const removeExpression = (payload: Expression) => (
  dispatch: Dispatch<any>,
  getState: GetState,
) => {
  dispatch({
    payload: {
      ...payload,
      // Sanitize the payload's storeId
      storeId: getStoreId(getState(), payload.storeId),
    },
    type: ReduxConstants.REMOVE_EXPRESSION,
  });
  checkIfProtected(getState());
};

export const updateExpression = (payload: Expression) => (
  dispatch: Dispatch<any>,
  getState: GetState,
) => {
  dispatch({
    payload: {
      ...payload,
      // Sanitize the payload's storeId
      storeId: getStoreId(getState(), payload.storeId),
    },
    type: ReduxConstants.UPDATE_EXPRESSION,
  });
  checkIfProtected(getState());
};

export const addActivity = (payload: CacheResults) => ({
  payload,
  type: ReduxConstants.ADD_ACTIVITY_LOG,
});

export const incrementCookieDeletedCounter = (
  payload: number,
): INCREMENT_COOKIE_DELETED_COUNTER => ({
  payload,
  type: ReduxConstants.INCREMENT_COOKIE_DELETED_COUNTER,
});

export const resetCookieDeletedCounter = (): RESET_COOKIE_DELETED_COUNTER => ({
  type: ReduxConstants.RESET_COOKIE_DELETED_COUNTER,
});

export const updateSetting = (payload: Setting): UPDATE_SETTING => ({
  payload,
  type: ReduxConstants.UPDATE_SETTING,
});

export const resetSettings = (): RESET_SETTINGS => ({
  type: ReduxConstants.RESET_SETTINGS,
});

// Validates the setting object and adds missing settings if it doesn't already exist in the initialState.json
export const validateSettings = () => (
  dispatch: Dispatch<Action>,
  getState: GetState,
) => {
  const { settings } = getState();
  const initialSettings = initialState.settings;
  const settingKeys = Object.keys(settings);
  const initialSettingKeys = Object.keys(initialSettings);

  const invividalSettingKeysMatch =
    Object.keys(settings[settingKeys[0]]).length ===
    Object.keys(initialSettings[initialSettingKeys[0]]).length;

  // Missing a property in a individual setting
  if (!invividalSettingKeysMatch) {
    settingKeys.forEach(element => {
      dispatch({
        payload: settings[element],
        type: ReduxConstants.UPDATE_SETTING,
      });
    });
  }

  // Missing a setting
  if (settingKeys.length !== initialSettingKeys.length) {
    initialSettingKeys.forEach(element => {
      if (settings[element] === undefined) {
        dispatch({
          payload: initialSettings[element],
          type: ReduxConstants.UPDATE_SETTING,
        });
      }
    });
  }
};

export const cookieCleanupUI = (payload: CleanupProperties) => ({
  payload,
  type: ReduxConstants.COOKIE_CLEANUP,
});

// Cookie Cleanup operation that is to be called from the React UI
export const cookieCleanup = (
  options: CleanupProperties = { greyCleanup: false, ignoreOpenTabs: false },
) => async (dispatch: Dispatch<Action>, getState: GetState) => {
  const newOptions = options;
  // Add in default cleanup settings if payload does not provide any
  // if (options.payload !== undefined) {
  //   newOptions = {
  //     ...options.payload
  //   };
  // } else if (
  //   options.payload === undefined &&
  //   (options.greyCleanup !== undefined || options.ignoreOpenTabs !== undefined)
  // ) {
  //   newOptions = options;
  // } else {
  //   newOptions = {
  //     greyCleanup: false,
  //     ignoreOpenTabs: false
  //   };
  // }

  // if (
  //   getState().cache.browserVersion === '58' &&
  //   getState().cache.firstPartyIsolateSetting
  // ) {
  //   browser.notifications.create('FPI_NOTIFICATION', {
  //     type: 'basic',
  //     iconUrl: browser.extension.getURL('icons/icon_48.png'),
  //     title: 'First Party Isolation Detected',
  //     message:
  //       'Please turn off privacy.firstparty.isolate and restart the browser as it breaks cookie cleanup'
  //   });
  // }

  const cleanupDoneObject = await cleanCookiesOperation(getState(), newOptions);
  const { setOfDeletedDomainCookies, cachedResults } = cleanupDoneObject;
  const { recentlyCleaned } = cachedResults;

  // Increment the count
  if (recentlyCleaned !== 0 && getSetting(getState(), 'statLogging')) {
    dispatch(incrementCookieDeletedCounter(recentlyCleaned));
  }

  if (recentlyCleaned !== 0 && getSetting(getState(), 'statLogging')) {
    dispatch(addActivity(cachedResults));
  }

  // Show notifications after cleanup
  if (
    setOfDeletedDomainCookies.size > 0 &&
    getSetting(getState(), 'showNotificationAfterCleanup')
  ) {
    const notifyMessage = browser.i18n.getMessage('notificationContent', [
      recentlyCleaned.toString(),
      Array.from(setOfDeletedDomainCookies).join(', '),
    ]);
    browser.notifications.create(COOKIE_CLEANUP_NOTIFICATION, {
      iconUrl: browser.extension.getURL('icons/icon_48.png'),
      message: notifyMessage,
      title: browser.i18n.getMessage('notificationTitle'),
      type: 'basic',
    });
    const seconds = parseInt(
      `${getSetting(getState(), 'notificationOnScreen')}000`,
      10,
    );
    setTimeout(() => {
      browser.notifications.clear(COOKIE_CLEANUP_NOTIFICATION);
    }, seconds);
  }
};

// Map the cookieStoreId to their actual names and store in cache
export const cacheCookieStoreIdNames = () => async (
  dispatch: Dispatch<Action>,
) => {
  const contextualIdentitiesObjects = await browser.contextualIdentities.query(
    {},
  );
  dispatch({
    map: {
      key: 'default',
      value: 'Default',
    },
    type: ReduxConstants.ADD_CACHE,
  });
  dispatch({
    map: {
      key: 'firefox-default',
      value: 'Default',
    },
    type: ReduxConstants.ADD_CACHE,
  });
  dispatch({
    map: {
      key: 'firefox-private',
      value: 'Private',
    },
    type: ReduxConstants.ADD_CACHE,
  });
  contextualIdentitiesObjects.forEach(object =>
    dispatch({
      payload: {
        key: object.cookieStoreId,
        value: object.name,
      },
      type: ReduxConstants.ADD_CACHE,
    }),
  );
};
