import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Avatar, Box, Chip, CircularProgress, TextField, Typography } from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { contactService } from '../../../services';
import type { Contact } from '../../../types';
import { resolveMediaUrl } from '../../../utils/media';

interface RecipientInputProps {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
}

const RecipientInput: React.FC<RecipientInputProps> = ({
  value,
  onChange,
  label = 'Кому',
  placeholder = 'Введите имя или email сотрудника',
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const optionFilter = useMemo(
    () =>
      createFilterOptions<Contact>({
        stringify: (option) =>
          `${option.lastName} ${option.firstName} ${option.middleName || ''} ${option.email} ${option.position || ''}`,
      }),
    []
  );

  useEffect(() => {
    if (value.length === 0) {
      setSelectedContacts([]);
      return;
    }

    let active = true;
    void Promise.all(value.map((id) => contactService.getById(id).catch(() => null))).then((contacts) => {
      if (!active) return;

      const resolved = contacts.filter((contact): contact is Contact => Boolean(contact));
      setSelectedContacts(resolved);
      setOptions((prev) => {
        const map = new Map<string, Contact>();
        [...prev, ...resolved].forEach((contact) => map.set(contact.id, contact));
        return Array.from(map.values());
      });
    });

    return () => {
      active = false;
    };
  }, [value]);

  const commitExactMatch = (): boolean => {
    const normalizedInput = inputValue.trim().toLowerCase();
    if (!normalizedInput) {
      return false;
    }

    const exactMatch = options.find((option) => {
      const name = `${option.lastName} ${option.firstName} ${option.middleName || ''}`.trim().toLowerCase();
      return option.email.toLowerCase() === normalizedInput || name === normalizedInput;
    });

    if (!exactMatch || selectedContacts.some((contact) => contact.id === exactMatch.id)) {
      return false;
    }

    const nextValue = [...selectedContacts, exactMatch];
    setSelectedContacts(nextValue);
    onChange(nextValue.map((contact) => contact.id));
    setInputValue('');
    return true;
  };

  const handleInputChange = async (_event: React.SyntheticEvent, inputValue: string) => {
    setInputValue(inputValue);

    if (inputValue.length < 2) {
      setOptions(selectedContacts);
      return;
    }

    setLoading(true);
    try {
      const response = await contactService.search(1, 20, inputValue);
      setOptions(() => {
        const map = new Map<string, Contact>();
        [...selectedContacts, ...(response.data || [])].forEach((contact) => map.set(contact.id, contact));
        return Array.from(map.values());
      });
    } catch (error) {
      console.error('Failed to search contacts', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Autocomplete
      multiple
      open={open}
      value={selectedContacts}
      inputValue={inputValue}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      getOptionLabel={(option) => `${option.lastName} ${option.firstName}`}
      filterOptions={optionFilter}
      options={options}
      loading={loading}
      autoHighlight
      clearOnBlur={false}
      filterSelectedOptions
      selectOnFocus
      onInputChange={handleInputChange}
      onChange={(_event, newValue) => {
        setSelectedContacts(newValue);
        onChange(newValue.map((user) => user.id));
        setInputValue('');
      }}
      renderOption={(props, option) => (
        <li {...props}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar src={resolveMediaUrl(option.avatarUrl)} sx={{ width: 24, height: 24, mr: 1 }}>
              {option.firstName[0]}
            </Avatar>
            <Box>
              <Typography variant="body2">
                {option.lastName} {option.firstName} {option.middleName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.email} {option.position ? ` • ${option.position}` : ''}
              </Typography>
            </Box>
          </Box>
        </li>
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            avatar={<Avatar src={resolveMediaUrl(option.avatarUrl)}>{option.firstName[0]}</Avatar>}
            label={`${option.lastName} ${option.firstName}`}
            {...getTagProps({ index })}
            key={option.id}
            size="small"
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === 'Tab') && commitExactMatch()) {
              event.preventDefault();
            }
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};

export default RecipientInput;
