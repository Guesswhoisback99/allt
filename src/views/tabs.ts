export function initTabs(): void {
  const tabs = document.querySelectorAll<HTMLElement>('.tab');
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.view').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const target = t.dataset['tab'];
      if (!target) return;
      const view = document.getElementById(target);
      if (view) view.classList.add('active');
    });
  });
}
