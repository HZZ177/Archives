/**
 * 组件预加载工具
 * 用于在应用启动时预加载关键组件，减少首次访问时的加载延迟
 */

/**
 * 预加载React.lazy组件
 * @param lazyComponent - 由React.lazy创建的组件
 * @returns Promise<void>
 */
export const preloadComponent = async (lazyComponent: React.LazyExoticComponent<any>): Promise<void> => {
  try {
    // 访问_payload是一个技巧，用于获取React.lazy组件的内部promise
    const componentPromise = (lazyComponent as any)._payload?._result;
    if (componentPromise) {
      await componentPromise;
      console.log('组件预加载成功:', (componentPromise as any).displayName || '未命名组件');
    }
  } catch (error) {
    console.warn('组件预加载失败:', error);
  }
};

/**
 * 预加载多个组件
 * @param components - 组件数组
 * @returns Promise<void>
 */
export const preloadComponents = async (components: React.LazyExoticComponent<any>[]): Promise<void> => {
  await Promise.all(components.map(component => preloadComponent(component)));
};

/**
 * 低优先级预加载 - 在浏览器空闲时间预加载组件
 * @param components - 组件数组
 */
export const preloadComponentsWithLowPriority = (components: React.LazyExoticComponent<any>[]): void => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    // @ts-ignore
    window.requestIdleCallback(() => {
      preloadComponents(components).then(() => {
        console.log('低优先级组件预加载完成');
      });
    });
  } else {
    // 降级为setTimeout
    setTimeout(() => {
      preloadComponents(components).then(() => {
        console.log('低优先级组件预加载完成 (setTimeout降级)');
      });
    }, 2000); // 延迟2秒执行，避免与应用初始化竞争资源
  }
};

/**
 * 通过资源提示预加载 - 添加资源预加载提示到头部
 * @param urls - 资源URL数组
 */
export const addPreloadHints = (urls: string[]): void => {
  if (typeof document !== 'undefined') {
    urls.forEach(url => {
      const linkElement = document.createElement('link');
      linkElement.rel = 'preload';
      linkElement.as = url.endsWith('.js') ? 'script' : 'style';
      linkElement.href = url;
      document.head.appendChild(linkElement);
    });
  }
}; 