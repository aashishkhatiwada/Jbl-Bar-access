import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {ValueControl} from '../src/components/ValueControl';
import {Segmented} from '../src/components/Segmented';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const C = (p: any) => React.createElement('Svg', p, p.children);
  return {__esModule: true, default: C, Path: C, Circle: C, Rect: C};
});

async function setup(extra: Partial<React.ComponentProps<typeof ValueControl>> = {}) {
  const onCommit = jest.fn();
  const onStep = jest.fn();
  await render(
    <ValueControl
      testID="vol"
      name="Volume"
      spec={{min: 0, max: 31, step: 1}}
      value={12}
      format={v => String(v)}
      spoken={v => 'Volume ' + v + ' of 31'}
      onCommit={onCommit}
      onStep={onStep}
      stepLabels={{down: 'Volume down', up: 'Volume up'}}
      dialogTitle="Set volume"
      {...extra}
    />,
  );
  return {onCommit, onStep};
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('ValueControl: three equivalent input paths', () => {
  test('steppers step once per tap, labelled', async () => {
    const {onStep} = await setup();
    await fireEvent.press(screen.getByLabelText('Volume up'));
    await fireEvent.press(screen.getByLabelText('Volume down'));
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  test('adjustable wrapper exposes value and handles rotor increment/decrement', async () => {
    const {onStep} = await setup();
    const adjustable = screen.getByTestId('vol-slider');
    expect(adjustable.props.accessibilityRole).toBe('adjustable');
    expect(adjustable.props.accessibilityValue).toEqual({min: 0, max: 31, now: 12, text: 'Volume 12 of 31'});
    await fireEvent(adjustable, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}});
    await fireEvent(adjustable, 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}});
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  test('slider commits after 300 ms idle and on release, never per move', async () => {
    const {onCommit} = await setup();
    const slider = screen.getByTestId('native-slider', {includeHiddenElements: true});
    await act(async () => {
      slider.props.onSlidingStart(12);
      slider.props.onValueChange(13);
      slider.props.onValueChange(14);
      slider.props.onValueChange(15);
    });
    expect(onCommit).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenCalledWith(15);
    await act(async () => slider.props.onSlidingComplete(15));
    expect(onCommit).toHaveBeenCalledTimes(1); // same value is not re-sent
    await act(async () => {
      slider.props.onSlidingStart(15);
      slider.props.onValueChange(20);
      slider.props.onSlidingComplete(20);
    });
    expect(onCommit).toHaveBeenLastCalledWith(20);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  test('typed dialog validates, announces errors, and commits', async () => {
    const {onCommit} = await setup();
    await fireEvent.press(screen.getByLabelText('Set volume by typing'));
    const input = screen.getByTestId('set-value-input');
    await fireEvent.changeText(input, '99');
    await fireEvent.press(screen.getByTestId('set-value-set'));
    expect(screen.getByTestId('set-value-error')).toHaveTextContent('Out of range. Enter 0 to 31, step 1.');
    expect(onCommit).not.toHaveBeenCalled();
    await fireEvent.changeText(input, '25');
    await fireEvent.press(screen.getByTestId('set-value-set'));
    expect(onCommit).toHaveBeenCalledWith(25);
  });

  test('disabled control disables every path', async () => {
    const {onStep} = await setup({disabled: true});
    expect(screen.getByLabelText('Volume up')).toBeDisabled();
    expect(screen.getByLabelText('Set volume by typing')).toBeDisabled();
    await fireEvent(screen.getByTestId('vol-slider'), 'accessibilityAction', {nativeEvent: {actionName: 'increment'}});
    expect(onStep).not.toHaveBeenCalled();
  });

  test('range ends disable the matching stepper', async () => {
    await setup({value: 31});
    expect(screen.getByLabelText('Volume up')).toBeDisabled();
    expect(screen.getByLabelText('Volume down')).not.toBeDisabled();
  });

  test('hold-to-repeat: press-in starts, press-out stops, the press is not double-counted', async () => {
    const start = jest.fn();
    const end = jest.fn();
    const {onStep} = await setup({onHoldStart: start, onHoldEnd: end});
    const up = screen.getByLabelText('Volume up');
    await fireEvent(up, 'pressIn');
    await fireEvent(up, 'pressOut');
    await fireEvent.press(up);
    expect(start).toHaveBeenCalledWith(1);
    expect(end).toHaveBeenCalled();
    expect(onStep).not.toHaveBeenCalled();
    // A screen reader activation arrives as a press alone: one step.
    await act(async () => jest.advanceTimersByTime(100));
    await fireEvent.press(up);
    expect(onStep).toHaveBeenCalledWith(1);
  });
});

describe('Segmented', () => {
  test('radio semantics carry selection without colour', async () => {
    const onChange = jest.fn();
    await render(<Segmented label="Bass level" options={[0, 1, 2].map(v => ({value: v, label: String(v + 1), spoken: 'Level ' + (v + 1)}))} value={1} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[1].props.accessibilityState).toMatchObject({checked: true});
    await fireEvent.press(screen.getByLabelText('Level 3'));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
