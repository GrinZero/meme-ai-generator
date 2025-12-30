/**
 * Transition - 过渡动画组件
 * 
 * 提供平滑的进入/退出动画效果
 */

import { useEffect, useState, useRef, memo, type ReactNode, useCallback, useMemo } from 'react';

interface TransitionProps {
  /** 是否显示 */
  show: boolean;
  /** 子元素 */
  children: ReactNode;
  /** 进入动画类名 */
  enter?: string;
  /** 进入时的起始状态 */
  enterFrom?: string;
  /** 进入时的结束状态 */
  enterTo?: string;
  /** 退出动画类名 */
  leave?: string;
  /** 退出时的起始状态 */
  leaveFrom?: string;
  /** 退出时的结束状态 */
  leaveTo?: string;
  /** 动画持续时间（毫秒） */
  duration?: number;
  /** 是否在首次渲染时显示动画 */
  appear?: boolean;
  /** 自定义类名 */
  className?: string;
}

export const Transition = memo(function Transition({
  show,
  children,
  enter = 'transition-all ease-out',
  enterFrom = 'opacity-0 transform scale-95',
  enterTo = 'opacity-100 transform scale-100',
  leave = 'transition-all ease-in',
  leaveFrom = 'opacity-100 transform scale-100',
  leaveTo = 'opacity-0 transform scale-95',
  duration = 200,
  appear = false,
  className = '',
}: TransitionProps) {
  // Compute initial state synchronously using useMemo
  const initialState = useMemo(() => {
    if (show && !appear) {
      return { shouldRender: true, animationClass: enterTo };
    }
    return { shouldRender: show, animationClass: '' };
    // Only compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [shouldRender, setShouldRender] = useState(initialState.shouldRender);
  const [animationClass, setAnimationClass] = useState(initialState.animationClass);
  const isFirstRender = useRef(true);
  const prevShow = useRef(show);

  // Handle visibility changes using event-driven approach
  const handleEnter = useCallback(() => {
    setAnimationClass(`${enter} ${enterFrom}`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimationClass(`${enter} ${enterTo}`);
      });
    });
  }, [enter, enterFrom, enterTo]);

  const handleLeave = useCallback(() => {
    setAnimationClass(`${leave} ${leaveFrom}`);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimationClass(`${leave} ${leaveTo}`);
      });
    });
  }, [leave, leaveFrom, leaveTo]);

  // Use effect to synchronize with DOM
  useEffect(() => {
    // Skip if show hasn't changed
    if (prevShow.current === show && !isFirstRender.current) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (show) {
      // Element needs to be rendered first
      if (!shouldRender) {
        // Schedule render update via microtask to avoid sync setState
        queueMicrotask(() => {
          setShouldRender(true);
        });
      }
      
      // 如果是首次渲染且不需要动画，直接显示
      if (isFirstRender.current && !appear) {
        queueMicrotask(() => {
          setAnimationClass(enterTo);
        });
      } else {
        // 进入动画
        queueMicrotask(handleEnter);
      }
    } else {
      // 退出动画
      queueMicrotask(handleLeave);
      
      // 动画结束后移除元素
      timer = setTimeout(() => {
        setShouldRender(false);
      }, duration);
    }

    isFirstRender.current = false;
    prevShow.current = show;

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [show, appear, enterTo, duration, shouldRender, handleEnter, handleLeave]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`${animationClass} ${className}`}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
});

/**
 * FadeTransition - 淡入淡出过渡
 */
interface FadeTransitionProps {
  show: boolean;
  children: ReactNode;
  duration?: number;
  className?: string;
}

export const FadeTransition = memo(function FadeTransition({
  show,
  children,
  duration = 200,
  className = '',
}: FadeTransitionProps) {
  return (
    <Transition
      show={show}
      enter="transition-opacity ease-out"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity ease-in"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      duration={duration}
      className={className}
    >
      {children}
    </Transition>
  );
});

/**
 * SlideTransition - 滑动过渡
 */
interface SlideTransitionProps {
  show: boolean;
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  className?: string;
}

const slideDirections = {
  up: {
    from: 'translate-y-4',
    to: 'translate-y-0',
  },
  down: {
    from: '-translate-y-4',
    to: 'translate-y-0',
  },
  left: {
    from: 'translate-x-4',
    to: 'translate-x-0',
  },
  right: {
    from: '-translate-x-4',
    to: 'translate-x-0',
  },
};

export const SlideTransition = memo(function SlideTransition({
  show,
  children,
  direction = 'up',
  duration = 200,
  className = '',
}: SlideTransitionProps) {
  const { from, to } = slideDirections[direction];
  
  return (
    <Transition
      show={show}
      enter="transition-all ease-out"
      enterFrom={`opacity-0 transform ${from}`}
      enterTo={`opacity-100 transform ${to}`}
      leave="transition-all ease-in"
      leaveFrom={`opacity-100 transform ${to}`}
      leaveTo={`opacity-0 transform ${from}`}
      duration={duration}
      className={className}
    >
      {children}
    </Transition>
  );
});

/**
 * ScaleTransition - 缩放过渡
 */
interface ScaleTransitionProps {
  show: boolean;
  children: ReactNode;
  duration?: number;
  className?: string;
}

export const ScaleTransition = memo(function ScaleTransition({
  show,
  children,
  duration = 200,
  className = '',
}: ScaleTransitionProps) {
  return (
    <Transition
      show={show}
      enter="transition-all ease-out"
      enterFrom="opacity-0 transform scale-95"
      enterTo="opacity-100 transform scale-100"
      leave="transition-all ease-in"
      leaveFrom="opacity-100 transform scale-100"
      leaveTo="opacity-0 transform scale-95"
      duration={duration}
      className={className}
    >
      {children}
    </Transition>
  );
});
