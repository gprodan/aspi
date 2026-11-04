# Git pentru un proiect de automatizare – ghid minimal

```
git init
git config user.name "Nume Prenume"
git config user.email "adresa@exemplu.ro"
git add specificatie_functionala.md lista_IO.csv CHANGELOG.md .gitignore
git commit -m "Specificație și listă I/E, versiunea inițială"

git switch -c adauga-clatire          # ramură pentru o modificare
# ... modificați fișierele ...
git diff                               # ce s-a schimbat
git add -A && git commit -m "Adaugă pasul S5 Clătire (XV101 5 s) și testul T8"

git switch main
git merge adauga-clatire               # îmbină modificarea
git tag v1.0                           # versiunea livrată
git log --oneline --graph
```

Reguli:
1. Un commit = o modificare logică, cu mesaj care spune *ce* și *de ce*.
2. Programul de pe instalație trebuie să corespundă unui tag (ex. `v1.0`).
3. Exportați blocurile SCL ca fișiere text (`.scl`) ca să poată fi comparate cu `git diff`; arhiva TIA Portal este binară.
4. Nu modificați programul pe instalație fără a-l reintroduce în depozit.
