drop trigger attempts_immutable on public.attempts;

create trigger attempts_immutable
before update on public.attempts
for each row execute function public.prevent_attempt_mutation();
