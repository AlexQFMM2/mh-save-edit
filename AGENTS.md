# 项目开发规矩

## 组件化

- 尽量组件化，避免维护超长的单一文件。
- 每个页面、每个组件都必须有独立的 `.tsx` 和 `.css` 文件。
- 小程序页面按原生页面文件拆分，不把业务样式堆进全局样式文件。
- 页面和组件应保持清晰的职责边界；不要为了少几个文件，把多个页面或多个组件合并到一个文件中。

## CSS 职责边界

- 页面 CSS 只负责页面骨架、页面级布局、组件摆放，以及传给组件的尺寸变量。
- 页面 CSS 不得编写组件内部样式。
- 组件 CSS 只负责该组件内部布局、尺寸比例、状态样式和滚动区域。
- 新页面或新组件的主要样式不得继续堆进全局 `styles.css`。
- 全局样式只允许放真正全局的内容：reset、字体、根布局和基础设计变量。

## CSS 变量命名

- CSS 变量必须带所属前缀，前缀来自页面名或组件名，避免页面和组件之间互相污染。
- CSS 变量格式必须为：

  ```text
  --<组件或页面名字>-<组件或页面类型>-<具体变量>
  ```

- 组件默认尺寸必须写在组件自己的 CSS 文件中。
- 外部页面只能通过覆盖组件公开的 CSS 变量来传入尺寸。
- 组件内部尺寸必须从组件自己的变量或局部派生变量计算。
- 组件内部变量应使用组件前缀，不能直接复用页面私有变量。

## 父页面与组件边界

- 父页面不能直接选择组件内部 DOM class 来修改组件宽高。
- 父页面需要调整组件尺寸时，必须覆盖组件公开的 CSS 变量。
- 如果组件需要新的可配置尺寸，应先在组件 CSS 中定义公开变量和默认值，再由父页面覆盖。
- 不得通过提高选择器权重、`!important` 或 DOM 结构选择器绕过上述边界。

## 示例

组件：`ui/components/GameCard/GameCard.tsx` 与 `GameCard.css`

```css
/* GameCard.css */
.game-card {
  --game-card-component-width: 280px;
  --game-card-component-padding: 16px;
  width: var(--game-card-component-width);
  padding: var(--game-card-component-padding);
}
```

页面只能这样传入尺寸：

```css
/* GameSelectorPage.css */
.game-selector-page {
  --game-selector-page-game-card-width: 320px;
}

.game-selector-page__card-slot {
  --game-card-component-width: var(--game-selector-page-game-card-width);
}
```

CSS 变量会从页面提供的容器继承到 `GameCard`。页面不得直接选择 `.game-card`，也不得修改组件内部的 `.game-card__body`、`.game-card__icon` 等 class 的尺寸。
