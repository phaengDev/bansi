import React,{useState,useEffect} from "react";
import { Config } from "./connection";
const api=Config.API;

export function useProvince() {
    const [itemProvince, setItemProvince] = useState([]);
    useEffect(() => {
      const showProvince = async () => {
        try {
          const response = await fetch(api + 'province');
          const jsonData = await response.json();
          setItemProvince(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showProvince();
    }, []);
    const data = itemProvince.map(item => ({ label: item.province_name, value: item.province_id }));
    return data;
  }

  export function useDistrict(id) {
    const [itemDistrict, setItemDistrict] = useState([]);
    useEffect(() => {
      const showDistrict = async () => {
        try {
          const response = await fetch(api + 'district/pv/'+id);
          const jsonData = await response.json();
          setItemDistrict(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showDistrict();
    }, [id]);
    const data = itemDistrict.map(item => ({ label: item.district_name, value: item.district_id }));
    return data;
  }



export function useDepart() {
    const [itemDepart, setItemDepart] = useState([]);
    useEffect(() => {
      const showDepart = async () => {
        try {
          const response = await fetch(api + 'depart');
          const jsonData = await response.json();
          setItemDepart(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showDepart();
    }, []);
    const data = itemDepart.map(item => ({ label: item.depart_name, value: item.department_id }));
    return data;
  }

  export function useRights() {
    const [itemRights, setItemRights] = useState([]);
    useEffect(() => {
      const showRights = async () => {
        try {
          const response = await fetch(api + 'rights');
          const jsonData = await response.json();
          setItemRights(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showRights();
    }, []);
    const data = itemRights.map(item => ({ label: item.rightsName, value: item.rightsId }));
    return data;
  }
  



  export function useStaff() {
    const [itemStaff, setItemStaff] = useState([]);
    useEffect(() => {
      const showStaff = async () => {
        try {
          const response = await fetch(api + 'staff/option');
          const jsonData = await response.json();
          setItemStaff(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showStaff();
    }, []);
    const data = itemStaff.map(item => ({ label: item.first_name+' '+item.first_name, value: item.employee_id }));
    return data;
  }
  


  export function useType() {
    const [itemType, setItemType] = useState([]);
    useEffect(() => {
      const showType = async () => {
        try {
          const response = await fetch(api + 'type/group');
          const jsonData = await response.json();
          setItemType(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showType();
    }, []);
    const data = itemType.map(item => ({ label: '( '+item.type_code+' ) '+item.type_name, value: item.type_acount_id,codes:item.type_code,status_type:item.status_type }));
    return data;
  }


  export function useStatus() {
    const [itemStatus, setItemStatus] = useState([]);
    useEffect(() => {
      const showStatus = async () => {
        try {
          const response = await fetch(api + 'type/sts');
          const jsonData = await response.json();
          setItemStatus(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showStatus();
    }, []);
    const data = itemStatus.map(item => ({ label: '( '+item.statusCode+' ) '+item.statusName, value: item.status_id, codes:item.statusCode }));
    return data;
  }



  export function useTypeList(id) {
    const [itemTypeList, setItemTypeList] = useState([]);
    useEffect(() => {
      const showTypeList = async () => {
        try {
          const response = await fetch(api + 'type/list/'+id);
          const jsonData = await response.json();
          setItemTypeList(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showTypeList();
    }, [id]);
    const data = itemTypeList.map(item => ({ label: item.acount_name +' ( '+ item.currency +' )', value: item.type_treasury_id,codes:item.treasury_code,genus:item.genus }));
    return data;
  }


  export function useAcount(id) { // ==============  ປະເພດບັນຊີ
    const [itemAcount, setItemAcount] = useState([]);
    useEffect(() => {
      const showAcount = async () => {
        try {
          const response = await fetch(api + 'acounts/type/'+id);
          const jsonData = await response.json();
          setItemAcount(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showAcount();
    }, [id]);
    const data = itemAcount.map(item => ({ label: item.acount_number+' ( '+item.currency+' )', value: item.treasury_id,numbers:item.acount_number,genus:item.genus }));
    return data;
  }


  export function useBank() { // ==============  ທະນາຄານ
    const [itemBank, setItemBank] = useState([]);
    useEffect(() => {
      const showBank = async () => {
        try {
          const response = await fetch(api + 'currency/bank');
          const jsonData = await response.json();
          setItemBank(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showBank();
    }, []);
    const data = itemBank.map(item => ({ label: item.bankName, value: item.bankId,codes:item.codeBank }));
    return data;
  }



  export function useCurrency() { // ==============  ສະກຸນເງິນ
    const [itemCurrency, setItemCurrency] = useState([]);
    useEffect(() => {
      const showCurrency = async () => {
        try {
          const response = await fetch(api + 'currency');
          const jsonData = await response.json();
          setItemCurrency(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showCurrency();
    }, []);
    const data = itemCurrency.map(item => ({ label: item.currency +' ( '+item.genus+' ) ', value: item.currencyId,genus:item.genus }));
    return data;
  }



  export function useTypeInXep(type) { // ==============  ປະເພດລາຍຮັບ ລາຍຈ່າຍ
    const [itemTypeInExp, setItemTypeInExp] = useState([]);
    useEffect(() => {
      const showTypeInExp = async () => {
        try {
          const response = await fetch(api + 'inex/type/'+type);
          const jsonData = await response.json();
          setItemTypeInExp(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showTypeInExp();
    }, [type]);
    const data = itemTypeInExp.map(item => ({ label:  item.in_ex_name, value: item.type_in_ex_Id,type_code:item.type_code }));
    return data;
  }


  export function useTypeLeave() { // ==============  ປະເພດລາພັກ
    const [itemTypeLeave, setItemTypeLeave] = useState([]);
    useEffect(() => {
      const showTypeLeave = async () => {
        try {
          const response = await fetch(api + 'typeLeave');
          const jsonData = await response.json();
          setItemTypeLeave(jsonData);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
      showTypeLeave();
    }, []);
    const data = itemTypeLeave.map(item => ({label: item.typeName, value: item.typeId}));
    return data;
  }


export function usePage(data) {
    const pages = [{
      label: 50, value: 50
    },
    {
      label: 100, value: 100
    },
    {
      label: 250, value: 250
    },
    {
      label: 500, value: 500
    },
    {
      label: 1000, value: 1000
    },
    {
      label: '--ທັງໝົດ--', value: data
    },];
  
    return pages;
  }
