import { cloneDeep } from 'lodash-es';
import { useCallback, useEffect, useRef, useState } from 'react';

import { settings } from '../../constants/Settings';
import { PICKER_KINDS, INTERVAL_VALUES, RELATIVE_VALUES } from '../../constants/DateConstants';
import dayjs from '../../utils/dayjs';

const { iotPrefix } = settings;

/**
 * Parses a value object into a human readable value
 * @param {Object} value - the currently selected value
 * @param {string} value.kind - preset/relative/absolute
 * @param {Object} value.preset - the preset selection
 * @param {Object} value - the relative time selection
 * @param {Object} value - the absolute time selection
 * @returns {Object} a human readable value and a furtherly augmented value object
 */
export const parseValue = (timeRange, dateTimeMask, toLabel) => {
  let readableValue = '';

  if (!timeRange) {
    return { readableValue };
  }

  const kind = timeRange.kind ?? timeRange.timeRangeKind;
  const value =
    kind === PICKER_KINDS.RELATIVE
      ? timeRange?.relative ?? timeRange.timeRangeValue
      : kind === PICKER_KINDS.ABSOLUTE
      ? timeRange?.absolute ?? timeRange.timeRangeValue
      : timeRange?.preset ?? timeRange.timeRangeValue;

  if (!value) {
    return { readableValue };
  }

  const returnValue = cloneDeep(timeRange);
  switch (kind) {
    case PICKER_KINDS.RELATIVE: {
      let endDate = dayjs();
      if (value.relativeToWhen !== '') {
        endDate =
          value.relativeToWhen === RELATIVE_VALUES.YESTERDAY
            ? dayjs().add(-1, INTERVAL_VALUES.DAYS)
            : dayjs();
        // wait to parse it until fully typed
        if (value.relativeToTime.length === 5) {
          endDate = endDate.hour(Number(value.relativeToTime.split(':')[0]));
          endDate = endDate.minute(Number(value.relativeToTime.split(':')[1]));
        }

        const startDate = endDate
          .clone()
          .subtract(
            value.lastNumber,
            value.lastInterval ? value.lastInterval : INTERVAL_VALUES.MINUTES
          );
        if (!returnValue.relative) {
          returnValue.relative = {};
        }
        returnValue.relative.start = new Date(startDate.valueOf());
        returnValue.relative.end = new Date(endDate.valueOf());
        readableValue = `${dayjs(startDate).format(dateTimeMask)} ${toLabel} ${dayjs(
          endDate
        ).format(dateTimeMask)}`;
      }
      break;
    }
    case PICKER_KINDS.ABSOLUTE: {
      let startDate = dayjs(value.start ?? value.startDate);
      if (value.startTime) {
        startDate = startDate.hours(value.startTime.split(':')[0]);
        startDate = startDate.minutes(value.startTime.split(':')[1]);
      }
      if (!returnValue.absolute) {
        returnValue.absolute = {};
      }
      returnValue.absolute.start = new Date(startDate.valueOf());
      if (value.end ?? value.endDate) {
        let endDate = dayjs(value.end ?? value.endDate);
        if (value.endTime) {
          endDate = endDate.hours(value.endTime.split(':')[0]);
          endDate = endDate.minutes(value.endTime.split(':')[1]);
        }
        returnValue.absolute.end = new Date(endDate.valueOf());
        readableValue = `${dayjs(startDate).format(dateTimeMask)} ${toLabel} ${dayjs(
          endDate
        ).format(dateTimeMask)}`;
      } else {
        readableValue = `${dayjs(startDate).format(dateTimeMask)} ${toLabel} ${dayjs(
          startDate
        ).format(dateTimeMask)}`;
      }
      break;
    }
    default:
      readableValue = value.label;
      break;
  }

  return { readableValue, ...returnValue };
};

export const useDateTimePickerRef = ({ id, v2 = false }) => {
  const previousActiveElement = useRef(null);
  const [datePickerElem, setDatePickerElem] = useState(null);

  /**
   * A callback ref to capture the DateTime node. When a user changes from Relative to Absolute
   * the calendar would capture focus and move the users position adding confusion to where they
   * are on the page. This also checks if they're currently focused on the Absolute radio button
   * and captures it so focus can be restored after the calendar has been re-parented below.
   */
  const handleDatePickerRef = useCallback((node) => {
    if (document.activeElement?.getAttribute('value') === PICKER_KINDS.ABSOLUTE) {
      previousActiveElement.current = document.activeElement;
    }

    setDatePickerElem(node);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (datePickerElem) {
        datePickerElem.cal.open();
        // while waiting for https://github.com/carbon-design-system/carbon/issues/5713
        // the only way to display the calendar inline is to re-parent its DOM to our component

        if (v2) {
          const dp = document.getElementById(`${id}-${iotPrefix}--date-time-picker__datepicker`);
          dp.appendChild(datePickerElem.cal.calendarContainer);
        } else {
          const wrapper = document.getElementById(`${id}-${iotPrefix}--date-time-picker__wrapper`);

          if (typeof wrapper !== 'undefined' && wrapper !== null) {
            const dp = document
              .getElementById(`${id}-${iotPrefix}--date-time-picker__wrapper`)
              .getElementsByClassName(`${iotPrefix}--date-time-picker__datepicker`)[0];
            dp.appendChild(datePickerElem.cal.calendarContainer);
          }
        }

        // if we were focused on the Absolute radio button previously, restore focus to it.
        /* istanbul ignore if */
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
          previousActiveElement.current = null;
        }
      }
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [datePickerElem, id, v2]);

  return [datePickerElem, handleDatePickerRef];
};

export const useDateTimePickerFocus = (datePickerElem) => {
  const [focusOnFirstField, setFocusOnFirstField] = useState(true);

  useEffect(() => {
    if (datePickerElem && datePickerElem.inputField && datePickerElem.toInputField) {
      if (focusOnFirstField) {
        datePickerElem.inputField.click();
      } else {
        datePickerElem.toInputField.click();
      }
    }
  }, [datePickerElem, focusOnFirstField]);

  return [focusOnFirstField, setFocusOnFirstField];
};

export const isValidDate = (date, time) => {
  const isValid24HoursRegex = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
  return date instanceof Date && !Number.isNaN(date) && isValid24HoursRegex.test(time);
};

export const onDatePickerClose = (range, single, flatpickr) => {
  // force it to stay open
  /* istanbul ignore else */
  if (flatpickr) {
    flatpickr.open();
  }
};

// Validates absolute start date
export const invalidStartDate = (startTime, endTime, absoluteValues) => {
  // If start and end date have been selected
  if (
    absoluteValues.hasOwnProperty('start') &&
    absoluteValues.hasOwnProperty('end') &&
    isValidDate(new Date(absoluteValues.start), startTime)
  ) {
    const startDate = new Date(`${absoluteValues.startDate} ${startTime}`);
    const endDate = new Date(`${absoluteValues.endDate} ${endTime}`);
    return startDate >= endDate;
  }
  // Return invalid date if start time and end date not selected or if inputted time is not valid
  return true;
};

// Validates absolute end date
export const invalidEndDate = (startTime, endTime, absoluteValues) => {
  // If start and end date have been selected
  if (
    absoluteValues.hasOwnProperty('start') &&
    absoluteValues.hasOwnProperty('end') &&
    isValidDate(new Date(absoluteValues.end), endTime)
  ) {
    const startDate = new Date(`${absoluteValues.startDate} ${startTime}`);
    const endDate = new Date(`${absoluteValues.endDate} ${endTime}`);
    return startDate >= endDate;
  }
  // Return invalid date if start time and end date not selected or if inputted time is not valid
  return true;
};

export const useAbsoluteDateTimeValue = () => {
  const [absoluteValue, setAbsoluteValue] = useState(null);
  const [absoluteStartTimeInvalid, setAbsoluteStartTimeInvalid] = useState(false);
  const [absoluteEndTimeInvalid, setAbsoluteEndTimeInvalid] = useState(false);

  // Util func to update the absolute value
  const changeAbsolutePropertyValue = (property, value) => {
    setAbsoluteValue((prev) => ({
      ...prev,
      [property]: value,
    }));
  };

  const resetAbsoluteValue = () => {
    setAbsoluteValue({
      startDate: '',
      startTime: '00:00',
      endDate: '',
      endTime: '00:00',
    });
  };

  // on change functions that trigger a absolute value update
  const onAbsoluteStartTimeChange = (startTime, evt, meta) => {
    const { endTime } = absoluteValue;
    const invalidStart = invalidStartDate(startTime, endTime, absoluteValue);
    const invalidEnd = invalidEndDate(startTime, endTime, absoluteValue);
    setAbsoluteStartTimeInvalid(meta.invalid || invalidStart);
    setAbsoluteEndTimeInvalid(invalidEnd);
    changeAbsolutePropertyValue('startTime', startTime);
  };

  const onAbsoluteEndTimeChange = (endTime, evt, meta) => {
    const { startTime } = absoluteValue;
    const invalidEnd = invalidEndDate(startTime, endTime, absoluteValue);
    const invalidStart = invalidStartDate(startTime, endTime, absoluteValue);
    setAbsoluteEndTimeInvalid(meta.invalid || invalidEnd);
    setAbsoluteStartTimeInvalid(invalidStart);
    changeAbsolutePropertyValue('endTime', endTime);
  };

  return {
    absoluteValue,
    setAbsoluteValue,
    absoluteStartTimeInvalid,
    setAbsoluteStartTimeInvalid,
    absoluteEndTimeInvalid,
    setAbsoluteEndTimeInvalid,
    onAbsoluteStartTimeChange,
    onAbsoluteEndTimeChange,
    resetAbsoluteValue,
  };
};

export const useRelativeDateTimeValue = ({ defaultInterval, defaultRelativeTo }) => {
  const [relativeValue, setRelativeValue] = useState(null);
  const [relativeToTimeInvalid, setRelativeToTimeInvalid] = useState(false);
  const [relativeLastNumberInvalid, setRelativeLastNumberInvalid] = useState(false);

  const resetRelativeValue = () => {
    setRelativeValue({
      lastNumber: 0,
      lastInterval: defaultInterval,
      relativeToWhen: defaultRelativeTo,
      relativeToTime: '',
    });
  };

  // Util func to update the relative value
  const changeRelativePropertyValue = (property, value) => {
    setRelativeValue((prev) => ({
      ...prev,
      [property]: value,
    }));
  };

  // on change functions that trigger a relative value update
  const onRelativeLastNumberChange = (event) => {
    const valid = !event.imaginaryTarget.getAttribute('data-invalid');
    setRelativeLastNumberInvalid(!valid);
    if (valid) {
      changeRelativePropertyValue('lastNumber', Number(event.imaginaryTarget.value));
    }
  };
  const onRelativeLastIntervalChange = (event) => {
    changeRelativePropertyValue('lastInterval', event.currentTarget.value);
  };
  const onRelativeToWhenChange = (event) => {
    changeRelativePropertyValue('relativeToWhen', event.currentTarget.value);
  };
  const onRelativeToTimeChange = (pickerValue, evt, meta) => {
    setRelativeToTimeInvalid(meta.invalid);
    changeRelativePropertyValue('relativeToTime', pickerValue);
  };

  return {
    relativeValue,
    setRelativeValue,
    relativeToTimeInvalid,
    setRelativeToTimeInvalid,
    relativeLastNumberInvalid,
    setRelativeLastNumberInvalid,
    resetRelativeValue,
    onRelativeLastNumberChange,
    onRelativeLastIntervalChange,
    onRelativeToWhenChange,
    onRelativeToTimeChange,
  };
};

export const useDateTimePickerRangeKind = (showRelativeOption) => {
  const [customRangeKind, setCustomRangeKind] = useState(
    showRelativeOption ? PICKER_KINDS.RELATIVE : PICKER_KINDS.ABSOLUTE
  );

  const onCustomRangeChange = (kind) => {
    setCustomRangeKind(kind);
  };

  return [customRangeKind, setCustomRangeKind, onCustomRangeChange];
};

export const useDateTimePickerKeyboardInteraction = ({ expanded, setCustomRangeKind }) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const presetListRef = useRef(null);

  const getFocusableSiblings = () => {
    /* istanbul ignore else */
    if (presetListRef?.current) {
      const siblings = presetListRef.current.querySelectorAll('[tabindex]');
      return Array.from(siblings).filter(
        (sibling) => parseInt(sibling.getAttribute('tabindex'), 10) !== -1
      );
    }

    return [];
  };

  const onFieldInteraction = ({ key }) => {
    switch (key) {
      case 'Escape':
        setIsExpanded(false);
        break;
      // if the input box is focused and a down arrow is pressed this
      // moves focus to the first item in the preset list that has a tabindex
      case 'ArrowDown':
        /* istanbul ignore else */
        if (presetListRef?.current) {
          const listItems = getFocusableSiblings();
          /* istanbul ignore else */
          if (listItems?.[0]?.focus) {
            listItems[0].focus();
          }
        }
        break;
      default:
        setIsExpanded(!isExpanded);
        break;
    }
  };

  /**
   * Moves up the preset list to the previous focusable element or wraps around to the bottom
   * if already at the top.
   */
  const moveToPreviousElement = () => {
    const siblings = getFocusableSiblings();
    const index = siblings.findIndex((elem) => elem === document.activeElement);
    const previous = siblings[index - 1];
    if (previous) {
      previous.focus();
    } else {
      siblings[siblings.length - 1].focus();
    }
  };

  /**
   * Moves down the preset list to the next focusable element or wraps around to the top
   * if already at the bottom
   */
  const moveToNextElement = () => {
    const siblings = getFocusableSiblings();
    const index = siblings.findIndex((elem) => elem === document.activeElement);
    const next = siblings[index + 1];
    if (next) {
      next.focus();
    } else {
      siblings[0].focus();
    }
  };

  const onNavigatePresets = ({ key }) => {
    switch (key) {
      case 'ArrowUp':
        moveToPreviousElement();
        break;
      case 'ArrowDown':
        moveToNextElement();
        break;
      default:
        break;
    }
  };

  /**
   * Allows navigation back and forth between the radio buttons for Relative/Absolute
   *
   * @param {KeyboardEvent} e
   */
  const onNavigateRadioButton = (e) => {
    if (e.target.getAttribute('id').includes('absolute')) {
      setCustomRangeKind(PICKER_KINDS.RELATIVE);
      document.activeElement.parentNode.previousSibling
        .querySelector('input[type="radio"]')
        .focus();
    } else {
      setCustomRangeKind(PICKER_KINDS.ABSOLUTE);
      document.activeElement.parentNode.nextSibling.querySelector('input[type="radio"]').focus();
    }
  };

  return {
    presetListRef,
    isExpanded,
    setIsExpanded,
    getFocusableSiblings,
    onFieldInteraction,
    onNavigateRadioButton,
    onNavigatePresets,
  };
};

/**
 * Get an alternative human readable value for a preset to show in tooltips and dropdown
 * ie. 'Last 30 minutes' displays '2020-04-01 11:30 to Now' on the tooltip
 * @returns {string} an interval string, starting point in time to now
 */
export const getIntervalValue = ({ currentValue, strings, dateTimeMask, humanValue }) => {
  if (currentValue) {
    if (currentValue.kind === PICKER_KINDS.PRESET) {
      return `${dayjs().subtract(currentValue.preset.offset, 'minutes').format(dateTimeMask)} ${
        strings.toNowLabel
      }`;
    }
    return humanValue;
  }

  return '';
};

export const useDateTimePickerTooltip = ({ isExpanded }) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  /**
   * Shows and hides the tooltip with the humanValue (Relative) or full-range (Absolute) when
   * the user focuses or hovers on the input
   */
  const toggleTooltip = () => {
    if (isExpanded) {
      setIsTooltipOpen(false);
    } else {
      setIsTooltipOpen((prev) => !prev);
    }
  };

  return [isTooltipOpen, toggleTooltip];
};
